import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  createToltLink,
  derivePartnerDisplayName,
  getToltProgramId,
  normalizeToltPartner,
} from "../_shared/tolt.ts";
import {
  AppStoreConnectApiError,
  deactivateAppleCustomOfferCode,
  ensureAppleCustomOfferCode,
  getOfferCodeCampaignIdentifier,
} from "../_shared/appStoreConnect.ts";

const ACTIVE_PARTNER_STATUSES = new Set(["active", "approved"]);
const SVIX_TOLERANCE_SECONDS = 300;

const randomSuffix = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const sanitizeCodeSeed = (value: string | null | undefined) => {
  const normalized = (value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  if (!normalized) {
    return "CREATOR";
  }

  return normalized.slice(0, 8);
};

async function generateUniqueReferralCode(supabase: any, seed: string) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `COSMIQ-${seed}${randomSuffix()}`.slice(0, 20);
    const { data: existing, error } = await supabase
      .from("referral_codes")
      .select("id")
      .eq("code", candidate)
      .maybeSingle();

    if (error) throw error;
    if (!existing) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique referral code for Tolt partner");
}

type NormalizedToltPartner = NonNullable<ReturnType<typeof normalizeToltPartner>>;

async function upsertPartnerReferralCode(supabase: any, partner: NormalizedToltPartner) {
  if (!partner) {
    throw new Error("Missing Tolt partner payload");
  }

  const email = partner.email?.trim().toLowerCase() ?? null;
  const normalizedStatus = partner.status?.trim().toLowerCase() ?? null;
  const isActive = normalizedStatus ? ACTIVE_PARTNER_STATUSES.has(normalizedStatus) : true;

  let existingRecord: any = null;
  const { data: mappedRecord, error: mappedError } = await supabase
    .from("referral_codes")
    .select("id, code, tolt_link_id, apple_offer_code_id, apple_offer_code_status")
    .eq("tolt_partner_id", partner.id)
    .maybeSingle();

  if (mappedError) throw mappedError;
  existingRecord = mappedRecord;

  if (!existingRecord && email) {
    const { data: emailMatch, error: emailError } = await supabase
      .from("referral_codes")
      .select("id, code, tolt_link_id, apple_offer_code_id, apple_offer_code_status")
      .eq("owner_type", "influencer")
      .eq("influencer_email", email)
      .maybeSingle();

    if (emailError) throw emailError;
    existingRecord = emailMatch;
  }

  const displayName = derivePartnerDisplayName(partner);
  const seed = sanitizeCodeSeed(email?.split("@")[0] ?? displayName);
  const now = new Date().toISOString();

  if (!existingRecord) {
    const code = await generateUniqueReferralCode(supabase, seed);
    const { data: inserted, error: insertError } = await supabase
      .from("referral_codes")
      .insert({
        code,
        owner_type: "influencer",
        influencer_name: displayName,
        influencer_email: email,
        payout_method: "tolt",
        payout_identifier: null,
        is_active: isActive,
        affiliate_provider: "tolt",
        tolt_partner_id: partner.id,
        tolt_partner_status: normalizedStatus,
        tolt_synced_at: now,
      })
      .select("id, code, tolt_link_id, apple_offer_code_id, apple_offer_code_status")
      .single();

    if (insertError) throw insertError;
    existingRecord = inserted;
  } else {
    const { error: updateError } = await supabase
      .from("referral_codes")
      .update({
        influencer_name: displayName,
        influencer_email: email,
        payout_method: "tolt",
        is_active: isActive,
        affiliate_provider: "tolt",
        tolt_partner_id: partner.id,
        tolt_partner_status: normalizedStatus,
        tolt_synced_at: now,
      })
      .eq("id", existingRecord.id);

    if (updateError) throw updateError;
  }

  if (!existingRecord.tolt_link_id && isActive) {
    const link = await createToltLink({
      partnerId: partner.id,
      value: existingRecord.code,
      param: "ref",
    });

    const { error: linkUpdateError } = await supabase
      .from("referral_codes")
      .update({
        tolt_link_id: link.id,
        tolt_synced_at: new Date().toISOString(),
      })
      .eq("id", existingRecord.id);

    if (linkUpdateError) throw linkUpdateError;
    existingRecord.tolt_link_id = link.id;
  }

  try {
    if (isActive) {
      const customCode = await ensureAppleCustomOfferCode({
        customCode: existingRecord.code,
        existingCustomCodeId: existingRecord.apple_offer_code_id ?? null,
      });

      const { error: appleCodeUpdateError } = await supabase
        .from("referral_codes")
        .update({
          apple_offer_code_id: customCode.id,
          apple_offer_code_status: customCode.active === false ? "inactive" : "active",
          apple_offer_code_synced_at: new Date().toISOString(),
          apple_offer_campaign_identifier: getOfferCodeCampaignIdentifier(),
          apple_offer_code_last_error: null,
          apple_offer_code_expires_at: customCode.expirationDate ?? null,
        })
        .eq("id", existingRecord.id);

      if (appleCodeUpdateError) throw appleCodeUpdateError;
      existingRecord.apple_offer_code_id = customCode.id;
      existingRecord.apple_offer_code_status = customCode.active === false ? "inactive" : "active";
    } else {
      await deactivateAppleCustomOfferCode(existingRecord.apple_offer_code_id ?? null);
      const { error: appleCodeDisableError } = await supabase
        .from("referral_codes")
        .update({
          apple_offer_code_status: "inactive",
          apple_offer_code_synced_at: new Date().toISOString(),
          apple_offer_campaign_identifier: getOfferCodeCampaignIdentifier(),
          apple_offer_code_last_error: null,
        })
        .eq("id", existingRecord.id);

      if (appleCodeDisableError) throw appleCodeDisableError;
      existingRecord.apple_offer_code_status = "inactive";
    }
  } catch (error) {
    const errorMessage = error instanceof AppStoreConnectApiError
      ? error.details || error.message
      : error instanceof Error
        ? error.message
        : "Unknown Apple offer-code sync failure";

    const { error: appleCodeFailureUpdateError } = await supabase
      .from("referral_codes")
      .update({
        apple_offer_code_status: isActive ? "failed" : "inactive",
        apple_offer_code_synced_at: new Date().toISOString(),
        apple_offer_campaign_identifier: Deno.env.get("APPLE_OFFER_CODE_IDENTIFIER")?.trim() ?? null,
        apple_offer_code_last_error: errorMessage,
      })
      .eq("id", existingRecord.id);

    if (appleCodeFailureUpdateError) {
      throw appleCodeFailureUpdateError;
    }

    existingRecord.apple_offer_code_status = isActive ? "failed" : "inactive";
  }

  return existingRecord;
}

function getSvixHeader(req: Request, suffix: "id" | "timestamp" | "signature") {
  return req.headers.get(`svix-${suffix}`) ?? req.headers.get(`webhook-${suffix}`) ?? "";
}

function base64ToBytes(value: string) {
  const normalized = value.replace(/^whsec_/, "");
  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifySvixSignature(rawBody: string, headers: { id: string; timestamp: string; signature: string }, secret: string) {
  if (!headers.id || !headers.timestamp || !headers.signature) {
    throw new Error("Missing Svix headers");
  }

  const timestampSeconds = Number(headers.timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > SVIX_TOLERANCE_SECONDS) {
    throw new Error("Svix timestamp outside tolerance window");
  }

  const signedContent = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent),
  );
  const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  const signatures = headers.signature
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [version, value] = entry.split(",", 2);
      return { version, value };
    });

  const isValid = signatures.some(({ version, value }) => version === "v1" && timingSafeEqual(value ?? "", expectedSignature));
  if (!isValid) {
    throw new Error("Invalid Svix signature");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const secret = Deno.env.get("TOLT_WEBHOOK_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Missing TOLT_WEBHOOK_SECRET" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const headers = {
      id: getSvixHeader(req, "id"),
      timestamp: getSvixHeader(req, "timestamp"),
      signature: getSvixHeader(req, "signature"),
    };

    await verifySvixSignature(rawBody, headers, secret);
    const verifiedPayload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = typeof verifiedPayload.type === "string" ? verifiedPayload.type : "";

    if (!eventType.startsWith("partner.")) {
      return new Response(JSON.stringify({ success: true, ignored: true, eventType }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const partner = normalizeToltPartner(
      (verifiedPayload.data as Record<string, unknown> | undefined)?.partner ??
        verifiedPayload.data,
    );

    if (!partner) {
      return new Response(JSON.stringify({ error: "Unsupported Tolt partner payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ensure the required program-level configuration is present before syncing rows.
    getToltProgramId();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const referralCode = await upsertPartnerReferralCode(supabase, partner);

    return new Response(JSON.stringify({
      success: true,
      eventType,
      partnerId: partner.id,
      referralCode: referralCode.code,
      referralCodeId: referralCode.id,
      toltLinkId: referralCode.tolt_link_id ?? null,
      appleOfferCodeId: referralCode.apple_offer_code_id ?? null,
      appleOfferCodeStatus: referralCode.apple_offer_code_status ?? null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("tolt-webhook error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to process Tolt webhook",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
