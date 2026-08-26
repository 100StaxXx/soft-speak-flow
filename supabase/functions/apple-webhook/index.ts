import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  decodeProtectedHeader,
  importX509,
  jwtVerify,
  type JWTPayload,
} from "https://esm.sh/jose@5.8.0";
import {
  PemConverter,
  X509Certificate,
} from "https://esm.sh/@peculiar/x509@1.12.3";
import { upsertAccountEntitlement } from "../_shared/accountEntitlements.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  assertAppleProductBoundary,
  fetchAppleTransactionBinding,
  getDiscountedYearlyOfferId,
  getPriceCents,
  isGenesisYearlyOffer,
  isDiscountedYearlyOffer,
  resolvePlanFromProduct,
  resolveAppleBundleProductMode,
  upsertSubscription,
} from "../_shared/appleSubscriptions.ts";
import { normalizeAppAccountToken } from "../_shared/appleServerAPI.ts";

const defaultAppleBundleIds = ["com.darrylgraham.graceward", "com.darrylgraham.revolution"];
const GENESIS_SPECIAL_CODE = "GENESIS";
const WEBHOOK_PROVIDER = "apple";
const APPLE_ROOT_CA_G3_SHA256_FINGERPRINT =
  "63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179";
const appleWebhookAudiences = [
  Deno.env.get("APPLE_WEBHOOK_AUDIENCE"),
  Deno.env.get("APPLE_SERVICE_ID"),
  Deno.env.get("APPLE_IOS_BUNDLE_ID"),
].filter((value): value is string => Boolean(value));

if (appleWebhookAudiences.length === 0) {
  appleWebhookAudiences.push(...defaultAppleBundleIds);
}

/**
 * Apple Server-to-Server Notification Webhook
 *
 * This endpoint handles automatic notifications from Apple about subscription events:
 * - Renewals
 * - Cancellations
 * - Billing issues
 * - Refunds
 * - Plan changes
 *
 * Setup in App Store Connect:
 * 1. Go to App Information > App Store Server Notifications
 * 2. Add this URL as webhook endpoint
 * 3. Apple will send POST requests for subscription events
 *
 * SECURITY NOTE: Apple webhooks don't send Origin headers, so CORS is permissive.
 * The security comes from Apple's signedPayload JWS, whose x5c certificate chain
 * must terminate at Apple's pinned App Store root certificate.
 */

// Notification types from Apple
enum NotificationType {
  INITIAL_BUY = "INITIAL_BUY",
  SUBSCRIBED = "SUBSCRIBED",
  DID_RENEW = "DID_RENEW",
  DID_CHANGE_RENEWAL_STATUS = "DID_CHANGE_RENEWAL_STATUS",
  DID_CHANGE_RENEWAL_PREF = "DID_CHANGE_RENEWAL_PREF",
  DID_FAIL_TO_RENEW = "DID_FAIL_TO_RENEW",
  DID_RECOVER = "DID_RECOVER",
  CANCEL = "CANCEL",
  REFUND = "REFUND",
  RENEWAL_EXTENDED = "RENEWAL_EXTENDED",
  REVOKE = "REVOKE",
  PRICE_INCREASE_CONSENT = "PRICE_INCREASE_CONSENT",
}

enum NotificationSubtype {
  INITIAL_BUY = "INITIAL_BUY",
}

type AppleWebhookOptions = {
  payload?: any;
  supabaseClient?: any;
  now?: Date;
  trustedRootFingerprints?: string[];
};

export function isAppleServerNotificationPayload(
  payload: unknown,
): payload is { signedPayload: string } {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      typeof (payload as { signedPayload?: unknown }).signedPayload ===
        "string" &&
      (payload as { signedPayload: string }).signedPayload.length > 0,
  );
}

export async function handleAppleWebhookNotification(
  req: Request,
  options: AppleWebhookOptions = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    // Create Supabase client with service role for server operations
    const supabaseClient = options.supabaseClient ?? createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const payload = options.payload ?? await req.json();

    console.log("Received Apple notification:", {
      type: payload.notification_type ?? payload?.notificationType,
      timestamp: new Date().toISOString(),
    });

    let notificationContext;
    try {
      notificationContext = await buildNotificationContext(payload, {
        now: options.now,
        trustedRootFingerprints: options.trustedRootFingerprints,
      });
    } catch (verificationError) {
      console.error(
        "Apple webhook signature verification failed:",
        verificationError,
      );
      return new Response("Invalid signature", {
        status: 401,
        headers: getCorsHeaders(req),
      });
    }

    const {
      notificationType,
      notificationSubtype,
      latestReceiptInfo,
      autoRenewStatus,
      transactionInfo,
      environment,
      bundleId,
    } = notificationContext;

    const eventId = await eventIdForNotification(payload, notificationContext);
    const registeredEvent = await registerAppleWebhookEvent(
      supabaseClient,
      eventId,
      notificationType,
      {
        ...payload,
        decodedNotification: {
          notificationType,
          notificationSubtype,
          environment,
          originalTransactionId:
            latestReceiptInfo?.original_transaction_id ?? null,
          transactionId: latestReceiptInfo?.transaction_id ?? null,
          productId: latestReceiptInfo?.product_id ?? null,
        },
      },
    );

    if (registeredEvent.duplicate) {
      return new Response("OK", {
        status: 200,
        headers: getCorsHeaders(req),
      });
    }

    if (!latestReceiptInfo) {
      console.error("No receipt info in notification");
      return new Response("No receipt info", { status: 400 });
    }

    // Extract subscription details
    const originalTransactionId = latestReceiptInfo.original_transaction_id;
    const latestTransactionId = latestReceiptInfo.transaction_id ??
      originalTransactionId;
    const productId = latestReceiptInfo.product_id;
    const expiresDateMs = latestReceiptInfo.expires_date_ms;
    const purchaseDateMs = latestReceiptInfo.purchase_date_ms;
    const cancellationDateMs = latestReceiptInfo.cancellation_date_ms;
    const appAccountToken = normalizeAppAccountToken(
      typeof transactionInfo?.appAccountToken === "string"
        ? transactionInfo.appAccountToken
        : null,
    );

    assertAppleProductBoundary(
      productId,
      resolveAppleBundleProductMode(bundleId),
    );

    const binding = await fetchAppleTransactionBinding(
      supabaseClient,
      originalTransactionId,
    )
      .catch((bindingError) => {
        console.error(
          "Error fetching Apple transaction binding:",
          bindingError,
        );
        return null;
      });

    const userId = binding?.bound_user_id ?? appAccountToken;

    if (!userId) {
      console.log(
        "No user binding found for transaction:",
        originalTransactionId,
        "- waiting for verified app-account restore",
      );
      await markAppleWebhookEventProcessed(supabaseClient, eventId);
      // Still return 200 to prevent Apple from retrying
      return new Response("OK", {
        status: 200,
        headers: getCorsHeaders(req),
      });
    }

    // Determine plan from product ID
    const plan = resolvePlanFromProduct(productId);

    // Process notification based on type
    switch (notificationType) {
      case NotificationType.INITIAL_BUY:
      case NotificationType.SUBSCRIBED:
        // First-time subscription - handle activation AND referral payout
        await handleActivation(
          supabaseClient,
          userId,
          latestTransactionId,
          originalTransactionId,
          appAccountToken,
          productId,
          typeof transactionInfo?.offerIdentifier === "string"
            ? transactionInfo.offerIdentifier
            : null,
          typeof transactionInfo?.offerType === "number"
            ? transactionInfo.offerType
            : null,
          expiresDateMs,
          purchaseDateMs,
          environment,
        );
        if (
          notificationType === NotificationType.INITIAL_BUY ||
          notificationSubtype === NotificationSubtype.INITIAL_BUY
        ) {
          await createReferralPayout(
            supabaseClient,
            userId,
            originalTransactionId,
            plan,
            productId,
            typeof transactionInfo?.offerIdentifier === "string"
              ? transactionInfo.offerIdentifier
              : null,
            typeof transactionInfo?.offerType === "number"
              ? transactionInfo.offerType
              : null,
          );
        }
        break;

      case NotificationType.DID_RENEW:
      case NotificationType.DID_RECOVER:
        // Subscription renewed or recovered
        await handleActivation(
          supabaseClient,
          userId,
          latestTransactionId,
          originalTransactionId,
          appAccountToken,
          productId,
          typeof transactionInfo?.offerIdentifier === "string"
            ? transactionInfo.offerIdentifier
            : null,
          typeof transactionInfo?.offerType === "number"
            ? transactionInfo.offerType
            : null,
          expiresDateMs,
          purchaseDateMs,
          environment,
        );
        break;

      case NotificationType.DID_CHANGE_RENEWAL_STATUS: {
        // User enabled/disabled auto-renewal
        const willRenew = normalizeAutoRenewStatus(autoRenewStatus);
        await handleRenewalStatusChange(
          supabaseClient,
          userId,
          willRenew,
          expiresDateMs,
        );
        break;
      }

      case NotificationType.DID_CHANGE_RENEWAL_PREF:
        // User changed plan (e.g., monthly to yearly)
        await handlePlanChange(
          supabaseClient,
          userId,
          plan,
          expiresDateMs,
        );
        break;

      case NotificationType.DID_FAIL_TO_RENEW:
        // Billing issue - mark as past_due
        await handleBillingIssue(
          supabaseClient,
          userId,
          expiresDateMs,
        );
        break;

      case NotificationType.CANCEL:
      case NotificationType.REVOKE:
        // Apple revoked the entitlement; remove access immediately.
        await handleRefund(
          supabaseClient,
          userId,
          latestTransactionId,
          cancellationDateMs,
          notificationType.toLowerCase(),
        );
        break;

      case NotificationType.REFUND:
        // Payment refunded - revoke access
        await handleRefund(
          supabaseClient,
          userId,
          latestTransactionId,
          cancellationDateMs,
          "refund",
        );
        break;

      default:
        console.log("Unhandled notification type:", notificationType);
    }

    await markAppleWebhookEventProcessed(supabaseClient, eventId);

    // Return 200 to acknowledge receipt
    return new Response("OK", {
      status: 200,
      headers: getCorsHeaders(req),
    });
  } catch (error) {
    console.error("Error processing Apple notification:", error);

    // Still return 200 to prevent Apple from retrying
    return new Response("OK", {
      status: 200,
      headers: getCorsHeaders(req),
    });
  }
}

if (import.meta.main && Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleAppleWebhookNotification(req));
}

async function handleActivation(
  supabase: any,
  userId: string,
  transactionId: string,
  originalTransactionId: string,
  appAccountToken: string | null,
  productId: string,
  offerIdentifier: string | null,
  offerType: number | null,
  expiresDateMs: string,
  purchaseDateMs: string,
  environment?: string,
) {
  const expiresDate = new Date(parseInt(expiresDateMs));
  const purchaseDate = new Date(parseInt(purchaseDateMs));
  const normalizedPlan = resolvePlanFromProduct(productId);

  await upsertSubscription(supabase, {
    userId,
    transactionId,
    originalTransactionId,
    productId,
    offerIdentifier,
    offerType,
    appAccountToken,
    plan: normalizedPlan,
    expiresAt: expiresDate,
    purchaseDate,
    cancellationDate: null,
    environment,
    source: "webhook",
  });

  console.log(`Activated subscription for user ${userId}`);
}

type AppleJWSPayload = Record<string, unknown>;

async function buildNotificationContext(
  body: any,
  options: VerifyAppleNotificationOptions = {},
) {
  let notificationType = body?.notification_type as
    | NotificationType
    | undefined;
  let notificationSubtype = body?.subtype as NotificationSubtype | undefined;
  let latestReceiptInfo = body?.latest_receipt_info;
  let autoRenewStatus = body?.auto_renew_status;
  let transactionInfo: AppleJWSPayload | null = null;
  let environment = typeof body?.environment === "string"
    ? body.environment
    : undefined;
  let bundleId = typeof body?.bundleId === "string"
    ? body.bundleId
    : undefined;

  if (body?.signedPayload) {
    const rootPayload = await verifyAppleNotification(
      body.signedPayload,
      appleWebhookAudiences,
      { ...options, requireBundleId: true },
    );
    notificationType = rootPayload.notificationType as NotificationType;
    notificationSubtype = rootPayload.subtype as
      | NotificationSubtype
      | undefined;

    const data = (rootPayload.data ?? {}) as Record<string, unknown>;
    bundleId = typeof data.bundleId === "string" ? data.bundleId : bundleId;
    const bundleAudience = typeof data.bundleId === "string"
      ? data.bundleId
      : appleWebhookAudiences;
    environment = typeof data.environment === "string"
      ? data.environment
      : environment;

    if (typeof data.signedTransactionInfo === "string") {
      transactionInfo = await verifyAppleNotification(
        data.signedTransactionInfo,
        bundleAudience,
        { ...options, requireBundleId: true },
      );
    }

    let renewalInfo: AppleJWSPayload | null = null;
    if (typeof data.signedRenewalInfo === "string") {
      renewalInfo = await verifyAppleNotification(
        data.signedRenewalInfo,
        bundleAudience,
        options,
      );
      if (renewalInfo?.autoRenewStatus !== undefined) {
        autoRenewStatus = renewalInfo.autoRenewStatus;
      }
    }

    if (!latestReceiptInfo && transactionInfo) {
      latestReceiptInfo = convertTransactionToLegacyShape(transactionInfo);
    }
  }

  if (!notificationType) {
    throw new Error("Apple notification missing type");
  }

  return {
    notificationType,
    notificationSubtype,
    latestReceiptInfo,
    autoRenewStatus,
    transactionInfo,
    environment,
    bundleId,
  };
}

type VerifyAppleNotificationOptions = {
  now?: Date;
  requireBundleId?: boolean;
  trustedRootFingerprints?: string[];
};

export async function verifyAppleNotification(
  token: string,
  audience: string | string[],
  options: VerifyAppleNotificationOptions = {},
) {
  const normalizedAudience = (Array.isArray(audience) ? audience : [audience])
    .filter(
      (value): value is string => Boolean(value),
    );

  if (normalizedAudience.length === 0) {
    throw new Error("Missing Apple webhook audience configuration");
  }

  const protectedHeader = decodeProtectedHeader(token);
  if (protectedHeader.alg !== "ES256") {
    throw new Error("Unsupported Apple JWS algorithm");
  }

  const certificates = parseAppleX5cHeader(protectedHeader.x5c);
  const effectiveDate = options.now ?? signedDateFromToken(token) ?? new Date();
  await validateAppleX5cCertificateChain(
    certificates,
    effectiveDate,
    options.trustedRootFingerprints ?? trustedAppleRootFingerprints(),
  );

  const leafCertificatePem = PemConverter.encode(
    certificates[0].rawData,
    "CERTIFICATE",
  );
  const publicKey = await importX509(leafCertificatePem, "ES256");
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: ["ES256"],
  });

  validateApplePayloadBundleId(
    payload,
    normalizedAudience,
    Boolean(options.requireBundleId),
  );
  return payload as AppleJWSPayload;
}

function parseAppleX5cHeader(x5c: unknown): X509Certificate[] {
  if (!Array.isArray(x5c) || x5c.length < 3) {
    throw new Error("Apple JWS missing complete x5c certificate chain");
  }

  return x5c.map((encodedCertificate) => {
    if (typeof encodedCertificate !== "string" || !encodedCertificate) {
      throw new Error("Apple JWS x5c certificate is invalid");
    }

    return new X509Certificate(base64ToArrayBuffer(encodedCertificate));
  });
}

async function validateAppleX5cCertificateChain(
  certificates: X509Certificate[],
  effectiveDate: Date,
  trustedRootFingerprints: string[],
) {
  const trustedFingerprints = new Set(
    trustedRootFingerprints.map(normalizeFingerprint).filter(Boolean),
  );
  if (trustedFingerprints.size === 0) {
    throw new Error("Missing trusted Apple root certificate fingerprints");
  }

  const rootCertificate = certificates[certificates.length - 1];
  const rootFingerprint = await certificateSha256Fingerprint(rootCertificate);
  if (!trustedFingerprints.has(rootFingerprint)) {
    throw new Error("Apple JWS x5c chain does not terminate at a trusted root");
  }

  if (!await rootCertificate.isSelfSigned()) {
    throw new Error("Apple JWS trusted root certificate is not self-signed");
  }

  if (!await rootCertificate.verify({ date: effectiveDate })) {
    throw new Error("Apple JWS trusted root certificate is invalid");
  }

  for (let index = 0; index < certificates.length - 1; index += 1) {
    const childCertificate = certificates[index];
    const issuerCertificate = certificates[index + 1];

    if (childCertificate.issuer !== issuerCertificate.subject) {
      throw new Error("Apple JWS x5c certificate chain is out of order");
    }

    const verified = await childCertificate.verify({
      publicKey: issuerCertificate.publicKey,
      date: effectiveDate,
    });
    if (!verified) {
      throw new Error("Apple JWS x5c certificate chain signature is invalid");
    }
  }
}

function validateApplePayloadBundleId(
  payload: JWTPayload,
  expectedBundleIds: string[],
  requireBundleId: boolean,
) {
  const payloadBundleIds = bundleIdsFromApplePayload(payload);
  if (payloadBundleIds.length === 0) {
    if (requireBundleId) {
      throw new Error("Apple JWS payload is missing bundleId");
    }
    return;
  }

  if (!payloadBundleIds.some((bundleId) => expectedBundleIds.includes(bundleId))) {
    throw new Error("Apple JWS payload bundleId does not match this app");
  }
}

function bundleIdsFromApplePayload(payload: JWTPayload): string[] {
  const bundleIds: string[] = [];
  if (typeof payload.bundleId === "string") {
    bundleIds.push(payload.bundleId);
  }

  const data = payload.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const dataBundleId = (data as Record<string, unknown>).bundleId;
    if (typeof dataBundleId === "string") {
      bundleIds.push(dataBundleId);
    }
  }

  return [...new Set(bundleIds)];
}

function trustedAppleRootFingerprints() {
  const configured = Deno.env.get(
    "APPLE_WEBHOOK_ROOT_CA_SHA256_FINGERPRINTS",
  );
  if (!configured) {
    return [APPLE_ROOT_CA_G3_SHA256_FINGERPRINT];
  }

  return configured.split(/[,\s]+/).filter(Boolean);
}

async function certificateSha256Fingerprint(certificate: X509Certificate) {
  const digest = await crypto.subtle.digest("SHA-256", certificate.rawData);
  return bytesToHex(new Uint8Array(digest));
}

function signedDateFromToken(token: string): Date | undefined {
  try {
    const payload = decodeJwsPayloadWithoutVerification(token);
    const signedDate = payload.signedDate;
    if (typeof signedDate === "number" && Number.isFinite(signedDate)) {
      return new Date(signedDate);
    }
    if (typeof signedDate === "string" && signedDate) {
      const parsed = Number(signedDate);
      if (Number.isFinite(parsed)) return new Date(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function decodeJwsPayloadWithoutVerification(
  token: string,
): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWS format");
  }

  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const bytes = base64ToBytes(value);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function base64UrlToBytes(value: string): Uint8Array {
  let padded = value.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4 !== 0) {
    padded += "=";
  }
  return base64ToBytes(padded);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function normalizeFingerprint(value: string) {
  return value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

async function eventIdForNotification(
  payload: any,
  notificationContext: {
    notificationType: NotificationType;
    transactionInfo: AppleJWSPayload | null;
  },
) {
  if (typeof payload?.notificationUUID === "string") {
    return payload.notificationUUID;
  }

  if (payload?.signedPayload) {
    const rootPayload = decodeJwsPayloadWithoutVerification(payload.signedPayload);
    if (typeof rootPayload.notificationUUID === "string") {
      return rootPayload.notificationUUID;
    }
  }

  const transactionId = notificationContext.transactionInfo?.transactionId;
  if (typeof transactionId === "string" && transactionId) {
    return `${notificationContext.notificationType}:${transactionId}`;
  }

  return `sha256:${await sha256Hex(JSON.stringify(payload))}`;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function registerAppleWebhookEvent(
  supabaseClient: any,
  eventId: string,
  eventType: string,
  webhookEvent: any,
): Promise<{ duplicate: boolean }> {
  const { error } = await supabaseClient
    .from("payment_webhook_events")
    .insert({
      provider: WEBHOOK_PROVIDER,
      event_id: eventId,
      event_type: eventType,
      payload: webhookEvent,
      received_at: new Date().toISOString(),
    });

  if (!error) {
    return { duplicate: false };
  }

  if (error.code === "23505") {
    return { duplicate: true };
  }

  console.error("Failed to register Apple webhook event:", error);
  return { duplicate: false };
}

async function markAppleWebhookEventProcessed(
  supabaseClient: any,
  eventId: string,
) {
  const { error } = await supabaseClient
    .from("payment_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider", WEBHOOK_PROVIDER)
    .eq("event_id", eventId);

  if (error) {
    console.error("Failed to mark Apple webhook event processed:", error);
  }
}

function convertTransactionToLegacyShape(transactionInfo: AppleJWSPayload) {
  return {
    original_transaction_id: transactionInfo.originalTransactionId ??
      transactionInfo.transactionId,
    transaction_id: transactionInfo.transactionId,
    product_id: transactionInfo.productId,
    expires_date_ms: normalizeMillis(
      transactionInfo.expiresDate ?? transactionInfo.expiresDateMs,
    ),
    purchase_date_ms: normalizeMillis(
      transactionInfo.purchaseDate ?? transactionInfo.purchaseDateMs,
    ),
    cancellation_date_ms: normalizeMillis(
      transactionInfo.revocationDate ?? transactionInfo.revocationDateMs,
    ),
  };
}

function normalizeMillis(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function normalizeAutoRenewStatus(value: unknown) {
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

async function handleRenewalStatusChange(
  supabase: any,
  userId: string,
  willRenew: boolean,
  expiresDateMs: string,
) {
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    status: willRenew ? "active" : "cancelled",
    cancel_at: willRenew ? null : expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await upsertAccountEntitlement(supabase, {
    user_id: userId,
    source: "subscription",
    status: willRenew ? "active" : "cancelled",
    is_active: expiresDate > new Date(),
    ends_at: expiresDate.toISOString(),
    metadata: {
      billing_provider: "storekit2",
      billing_source_of_truth: "storekit2_transaction",
      webhook_event: "renewal_status_change",
    },
  });

  console.log(
    `Renewal status changed for user ${userId}: ${
      willRenew ? "enabled" : "disabled"
    }`,
  );
}

async function handlePlanChange(
  supabase: any,
  userId: string,
  newPlan: string,
  expiresDateMs: string,
) {
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    plan: newPlan,
    current_period_end: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await upsertAccountEntitlement(supabase, {
    user_id: userId,
    source: "subscription",
    plan: newPlan,
    ends_at: expiresDate.toISOString(),
    metadata: {
      billing_provider: "storekit2",
      billing_source_of_truth: "storekit2_transaction",
      webhook_event: "plan_change",
    },
  });

  console.log(`Plan changed for user ${userId} to ${newPlan}`);
}

async function handleBillingIssue(
  supabase: any,
  userId: string,
  expiresDateMs: string,
) {
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    status: "past_due",
    current_period_end: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  await upsertAccountEntitlement(supabase, {
    user_id: userId,
    source: "subscription",
    status: "past_due",
    is_active: expiresDate > new Date(),
    ends_at: expiresDate.toISOString(),
    metadata: {
      billing_provider: "storekit2",
      billing_source_of_truth: "storekit2_transaction",
      webhook_event: "billing_issue",
    },
  });

  console.log(`Billing issue for user ${userId}`);
}

async function handleCancellation(
  supabase: any,
  userId: string,
  cancellationDateMs: string,
  expiresDateMs: string,
) {
  const cancellationDate = new Date(parseInt(cancellationDateMs));
  const expiresDate = new Date(parseInt(expiresDateMs));

  await supabase.from("subscriptions").update({
    status: "cancelled",
    cancelled_at: cancellationDate.toISOString(),
    cancel_at: expiresDate.toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId);

  const isStillActive = expiresDate > new Date();

  await upsertAccountEntitlement(supabase, {
    user_id: userId,
    source: "subscription",
    status: "cancelled",
    is_active: isStillActive,
    ends_at: expiresDate.toISOString(),
    metadata: {
      billing_provider: "storekit2",
      billing_source_of_truth: "storekit2_transaction",
      webhook_event: "cancellation",
      cancelled_at: cancellationDate.toISOString(),
    },
  });

  console.log(
    `Subscription cancelled for user ${userId}, expires ${expiresDate.toISOString()}`,
  );
}

async function handleRefund(
  supabase: any,
  userId: string,
  transactionId: string,
  revokedAtMs?: string,
  webhookEvent = "refund",
) {
  const revokedAtTimestamp = revokedAtMs
    ? Number.parseInt(revokedAtMs, 10)
    : Number.NaN;
  const revokedAtDate = Number.isFinite(revokedAtTimestamp)
    ? new Date(revokedAtTimestamp)
    : new Date();
  const revokedAt = revokedAtDate.toISOString();

  // Immediately revoke access
  await supabase.from("subscriptions").update({
    status: "cancelled",
    cancelled_at: revokedAt,
    cancel_at: revokedAt,
    current_period_end: revokedAt,
    updated_at: revokedAt,
  }).eq("user_id", userId);

  await upsertAccountEntitlement(supabase, {
    user_id: userId,
    source: "subscription",
    status: "cancelled",
    is_active: false,
    ends_at: revokedAt,
    metadata: {
      billing_provider: "storekit2",
      billing_source_of_truth: "storekit2_transaction",
      webhook_event: webhookEvent,
      refunded_transaction_id: transactionId,
    },
  });

  // Mark payment as refunded
  await supabase.from("payment_history").update({
    status: "refunded",
  }).eq("stripe_payment_intent_id", transactionId);

  console.log(`Refund processed for user ${userId}`);
}

async function createReferralPayout(
  supabase: any,
  userId: string,
  transactionId: string,
  plan: string,
  productId?: string | null,
  offerIdentifier?: string | null,
  offerType?: number | null,
) {
  // Check if user was referred by someone using referral code
  const { data: profile } = await supabase
    .from("profiles")
    .select("referred_by_code, email")
    .eq("id", userId)
    .single();

  if (!profile?.referred_by_code) {
    console.log(`User ${userId} was not referred, no payout created`);
    return;
  }

  const referralCode = profile.referred_by_code;

  // Find the referral_code record with owner info
  const { data: codeData } = await supabase
    .from("referral_codes")
    .select(
      "id, code, owner_type, owner_user_id, is_active, apple_offer_code_status, apple_offer_campaign_identifier, apple_offer_code_expires_at, total_conversions, total_revenue",
    )
    .eq("code", referralCode)
    .single();

  if (!codeData) {
    console.error(`Referral code ${referralCode} not found`);
    return;
  }

  const isAppleOfferCodeEligible = Boolean(
    codeData.is_active &&
      codeData.apple_offer_code_status === "active" &&
      codeData.apple_offer_campaign_identifier?.toLowerCase() ===
        getDiscountedYearlyOfferId().toLowerCase() &&
      (!codeData.apple_offer_code_expires_at ||
        codeData.apple_offer_code_expires_at >=
          new Date().toISOString().slice(0, 10)),
  );
  const hasDiscountedYearlyOffer = plan === "yearly" &&
    isDiscountedYearlyOffer({
      offerIdentifier,
      offerType,
    });
  const hasGenesisYearlyOffer = plan === "yearly" &&
    isGenesisYearlyOffer({
      offerIdentifier,
      offerType,
    });

  if (codeData.owner_type === "influencer" && !isAppleOfferCodeEligible) {
    console.log(
      `Skipping affiliate commission for code ${referralCode} because the Apple custom offer code is not active`,
    );
    return;
  }

  if (!hasDiscountedYearlyOffer) {
    console.log(
      `Skipping affiliate commission for code ${referralCode} because the yearly offer-code discount was not redeemed`,
    );
    return;
  }

  if (referralCode.toUpperCase() === GENESIS_SPECIAL_CODE) {
    const genesisPriceCents = getPriceCents("yearly", {
      offerIdentifier,
      offerType,
    });

    await recordReferralCodeConversionMetrics(
      supabase,
      codeData.id,
      genesisPriceCents,
    );

    console.log(
      `Recorded Genesis offer conversion for ${userId}; no payout created`,
    );
    return;
  }

  if (hasGenesisYearlyOffer) {
    console.log(
      `Skipping affiliate commission for code ${referralCode} because the Genesis house offer was redeemed`,
    );
    return;
  }

  const yearlyPriceCents = getPriceCents("yearly", {
    offerIdentifier,
    offerType,
  });
  const payoutAmount = Number(((yearlyPriceCents / 100) * 0.2).toFixed(2));
  const payoutType = "first_year";

  // Check if payout already exists to avoid duplicates
  const { data: existingPayout } = await supabase
    .from("referral_payouts")
    .select("id")
    .eq("referral_code_id", codeData.id)
    .eq("referee_id", userId)
    .eq("payout_type", payoutType)
    .maybeSingle();

  if (existingPayout) {
    console.log(
      `Payout already exists for code ${referralCode}, referee ${userId}`,
    );
    return;
  }

  // Create pending payout (include referrer_id if owner has a user account)
  const { error } = await supabase
    .from("referral_payouts")
    .insert({
      referral_code_id: codeData.id,
      referrer_id: codeData.owner_user_id || null,
      referee_id: userId,
      amount: payoutAmount,
      status: "pending",
      payout_type: payoutType,
      apple_transaction_id: transactionId,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error(`Failed to create payout for code ${referralCode}:`, error);
    return;
  }

  console.log(
    `Created ${payoutType} payout of $${payoutAmount} for code ${referralCode} (${codeData.owner_type})`,
  );

  // Auto-approve payouts when threshold is reached ($50 minimum)
  await autoApprovePayoutsIfThresholdReached(
    supabase,
    codeData.id,
    referralCode,
  );
}

async function recordReferralCodeConversionMetrics(
  supabase: any,
  referralCodeId: string,
  revenueCents: number,
) {
  const { data: currentData, error: lookupError } = await supabase
    .from("referral_codes")
    .select("total_conversions, total_revenue")
    .eq("id", referralCodeId)
    .single();

  if (lookupError) {
    console.error("Failed to fetch referral code metrics:", lookupError);
    return;
  }

  const { error: updateError } = await supabase
    .from("referral_codes")
    .update({
      total_conversions: Number(currentData?.total_conversions ?? 0) + 1,
      total_revenue: Number(currentData?.total_revenue ?? 0) + revenueCents / 100,
    })
    .eq("id", referralCodeId);

  if (updateError) {
    console.error("Failed to update referral code metrics:", updateError);
  }
}

const MINIMUM_PAYOUT_THRESHOLD = 50.00;

async function autoApprovePayoutsIfThresholdReached(
  supabase: any,
  referralCodeId: string,
  referralCode: string,
) {
  // Get total pending payouts for this referral code
  const { data: pendingPayouts, error } = await supabase
    .from("referral_payouts")
    .select("id, amount")
    .eq("referral_code_id", referralCodeId)
    .eq("status", "pending");

  if (error || !pendingPayouts) {
    console.error("Failed to fetch pending payouts:", error);
    return;
  }

  const totalPending = pendingPayouts.reduce(
    (sum: number, p: { amount: number }) => sum + p.amount,
    0,
  );

  if (totalPending >= MINIMUM_PAYOUT_THRESHOLD) {
    // Auto-approve all pending payouts for this referral code
    const payoutIds = pendingPayouts.map((p: { id: string }) => p.id);

    const { error: updateError } = await supabase
      .from("referral_payouts")
      .update({
        status: "approved",
        admin_notes: "Auto-approved: threshold reached",
        updated_at: new Date().toISOString(),
      })
      .in("id", payoutIds);

    if (updateError) {
      console.error("Failed to auto-approve payouts:", updateError);
    } else {
      console.log(
        `Auto-approved ${payoutIds.length} payouts ($${
          totalPending.toFixed(2)
        }) for code ${referralCode}`,
      );
    }
  } else {
    console.log(
      `Total pending $${
        totalPending.toFixed(2)
      } for code ${referralCode} - below threshold ($${MINIMUM_PAYOUT_THRESHOLD})`,
    );
  }
}
