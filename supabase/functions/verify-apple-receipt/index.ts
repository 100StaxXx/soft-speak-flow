import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  APPLE_BINDING_CONFLICT_ERROR,
  APPLE_BINDING_MISSING_ERROR,
  buildSubscriptionResponse,
  extractLatestTransaction,
  resolvePlanFromProduct,
  upsertSubscription,
  verifyReceiptWithApple,
} from "../_shared/appleSubscriptions.ts";
import {
  isAppleApiError,
  verifyTransaction,
} from "../_shared/appleServerAPI.ts";
import {
  handleAppleWebhookNotification,
  isAppleServerNotificationPayload,
} from "../apple-webhook/index.ts";

const APPLE_BINDING_CONFLICT_CODE = "APPLE_BINDING_CONFLICT";
const APPLE_BINDING_MISSING_CODE = "APPLE_BINDING_MISSING";
const APPLE_MISSING_EXPIRATION_ERROR =
  "This Apple transaction is missing its subscription expiration date.";
const APPLE_UNSUPPORTED_TRANSACTION_TYPE_ERROR =
  "This Apple transaction is not an auto-renewable subscription.";

function isSandboxEnvironment(environment: string | undefined): boolean {
  return environment?.toLowerCase() === "sandbox";
}

type VerifyAppleReceiptDeps = {
  createSupabaseClient?: typeof createClient;
  verifyTransactionImpl?: typeof verifyTransaction;
  verifyReceiptWithAppleImpl?: typeof verifyReceiptWithApple;
  extractLatestTransactionImpl?: typeof extractLatestTransaction;
  resolvePlanFromProductImpl?: typeof resolvePlanFromProduct;
  upsertSubscriptionImpl?: typeof upsertSubscription;
  buildSubscriptionResponseImpl?: typeof buildSubscriptionResponse;
};

const defaultDeps: Required<VerifyAppleReceiptDeps> = {
  createSupabaseClient: createClient,
  verifyTransactionImpl: verifyTransaction,
  verifyReceiptWithAppleImpl: verifyReceiptWithApple,
  extractLatestTransactionImpl: extractLatestTransaction,
  resolvePlanFromProductImpl: resolvePlanFromProduct,
  upsertSubscriptionImpl: upsertSubscription,
  buildSubscriptionResponseImpl: buildSubscriptionResponse,
};

function buildErrorPayload(error: unknown): {
  statusCode: number;
  message: string;
  code?: string;
  upstreamStatus?: number;
  upstreamError?: string;
} {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  if (errorMessage === "Unauthorized") {
    return {
      statusCode: 401,
      message: "Unauthorized",
    };
  }

  if (errorMessage === APPLE_BINDING_CONFLICT_ERROR) {
    return {
      statusCode: 403,
      message: APPLE_BINDING_CONFLICT_ERROR,
      code: APPLE_BINDING_CONFLICT_CODE,
    };
  }

  if (errorMessage === APPLE_BINDING_MISSING_ERROR) {
    return {
      statusCode: 400,
      message: APPLE_BINDING_MISSING_ERROR,
      code: APPLE_BINDING_MISSING_CODE,
    };
  }

  if (isAppleApiError(error)) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      code: error.code,
      upstreamStatus: error.upstreamStatus,
      upstreamError: error.upstreamError,
    };
  }

  if (errorMessage.includes("not found")) {
    return {
      statusCode: 404,
      message: errorMessage,
    };
  }

  if (
    errorMessage.includes("invalid") ||
    errorMessage.includes("missing") ||
    errorMessage.includes("not configured") ||
    errorMessage.includes("not an auto-renewable") ||
    errorMessage.includes("required") ||
    errorMessage.includes("already register")
  ) {
    return {
      statusCode: 400,
      message: errorMessage,
    };
  }

  return {
    statusCode: 500,
    message: errorMessage,
  };
}

export async function handleVerifyAppleReceipt(
  req: Request,
  deps: VerifyAppleReceiptDeps = defaultDeps,
): Promise<Response> {
  const {
    createSupabaseClient,
    verifyTransactionImpl,
    verifyReceiptWithAppleImpl,
    extractLatestTransactionImpl,
    resolvePlanFromProductImpl,
    upsertSubscriptionImpl,
    buildSubscriptionResponseImpl,
  } = { ...defaultDeps, ...deps };
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    const serviceClient = createSupabaseClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    if (isAppleServerNotificationPayload(body)) {
      return await handleAppleWebhookNotification(req, {
        payload: body,
        supabaseClient: serviceClient,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const anonClient = createSupabaseClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const {
      data: { user },
    } = await anonClient.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const transactionId = body?.transactionId as string | undefined;
    const receipt = body?.receipt as string | undefined;

    // Prefer StoreKit 2 transaction verification, but fall back to legacy receipt verification
    // when App Store Server API verification fails and a receipt is available.
    if (transactionId) {
      try {
        console.log(
          `[verify-apple-receipt] Using App Store Server API v2 for transaction: ${transactionId}`,
        );

        const { transactionInfo, environment } = await verifyTransactionImpl(
          transactionId,
        );

        if (transactionInfo.type !== "Auto-Renewable Subscription") {
          throw new Error(APPLE_UNSUPPORTED_TRANSACTION_TYPE_ERROR);
        }

        if (!transactionInfo.expiresDate) {
          throw new Error(APPLE_MISSING_EXPIRATION_ERROR);
        }

        const plan = resolvePlanFromProductImpl(transactionInfo.productId);
        const expiresAt = new Date(transactionInfo.expiresDate);
        const purchaseDate = new Date(transactionInfo.purchaseDate);
        const cancellationDate = transactionInfo.revocationDate
          ? new Date(transactionInfo.revocationDate)
          : undefined;

        const subscription = await upsertSubscriptionImpl(serviceClient, {
          userId: user.id,
          transactionId: transactionInfo.transactionId,
          originalTransactionId: transactionInfo.originalTransactionId ||
            transactionInfo.transactionId,
          productId: transactionInfo.productId,
          offerIdentifier: transactionInfo.offerIdentifier ?? null,
          offerType: transactionInfo.offerType ?? null,
          appAccountToken: transactionInfo.appAccountToken ?? null,
          allowCreateWithoutAppAccountToken: isSandboxEnvironment(environment),
          plan,
          expiresAt,
          purchaseDate,
          cancellationDate,
          environment,
          source: "receipt",
        });

        console.log(
          `[verify-apple-receipt] Subscription verified via API v2: ${subscription?.id}`,
        );

        return jsonResponse(req, {
          success: true,
          environment,
          verificationMethod: "app_store_server_api_v2",
          subscription: buildSubscriptionResponseImpl(subscription),
        });
      } catch (txError) {
        const txErrorMessage = txError instanceof Error
          ? txError.message
          : String(txError ?? "");
        if (
          txErrorMessage === APPLE_BINDING_CONFLICT_ERROR ||
          txErrorMessage === APPLE_BINDING_MISSING_ERROR
        ) {
          throw txError;
        }
        if (!receipt) {
          throw txError;
        }
        console.warn(
          "[verify-apple-receipt] App Store Server API v2 verification failed; falling back to legacy receipt verification:",
          txError,
        );
      }
    }

    // Fallback to legacy receipt verification
    if (receipt) {
      console.log("[verify-apple-receipt] Using legacy verifyReceipt API");

      const { result, environment } = await verifyReceiptWithAppleImpl(receipt);
      const latestTransaction = extractLatestTransactionImpl(result);

      if (!latestTransaction) {
        throw new Error("No subscription transaction found in receipt");
      }

      if (!latestTransaction.transactionId) {
        throw new Error("Missing transaction identifier");
      }

      const plan = resolvePlanFromProductImpl(latestTransaction.productId);

      const subscription = await upsertSubscriptionImpl(serviceClient, {
        userId: user.id,
        transactionId: latestTransaction.transactionId,
        originalTransactionId: latestTransaction.originalTransactionId,
        productId: latestTransaction.productId,
        offerIdentifier: latestTransaction.offerIdentifier ?? null,
        offerType: latestTransaction.offerType ?? null,
        plan,
        allowCreateWithoutAppAccountToken: isSandboxEnvironment(environment),
        expiresAt: latestTransaction.expiresAt,
        purchaseDate: latestTransaction.purchaseDate,
        cancellationDate: latestTransaction.cancellationDate ?? undefined,
        environment,
        source: "receipt",
      });

      console.log(
        `[verify-apple-receipt] Subscription verified via legacy API: ${subscription?.id}`,
      );

      return jsonResponse(req, {
        success: true,
        environment,
        verificationMethod: "legacy_verify_receipt",
        subscription: buildSubscriptionResponseImpl(subscription),
      });
    }

    throw new Error("Either transactionId or receipt is required");
  } catch (error) {
    console.error("Error verifying receipt:", error);

    const errorPayload = buildErrorPayload(error);
    return jsonResponse(
      req,
      {
        error: errorPayload.message,
        ...(errorPayload.code ? { code: errorPayload.code } : {}),
        ...(typeof errorPayload.upstreamStatus === "number"
          ? { upstream_status: errorPayload.upstreamStatus }
          : {}),
        ...(typeof errorPayload.upstreamError === "string" &&
            errorPayload.upstreamError.length > 0
          ? { upstream_error: errorPayload.upstreamError }
          : {}),
      },
      errorPayload.statusCode,
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleVerifyAppleReceipt(req));
}
