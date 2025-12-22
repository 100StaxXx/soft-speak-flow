import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

/**
 * Record Subscription from alilpush
 * 
 * Called by alilpush after successful Apple IAP purchase.
 * Creates a pending payout for the referrer and updates conversion metrics.
 * Uses configurable commission rates from referral_config table.
 * 
 * SECURITY: This endpoint requires HMAC signature verification.
 * The caller must include an X-Signature header with HMAC-SHA256 of the request body.
 */

// Commission rate configuration interface
interface CommissionConfig {
  default: {
    monthly_percent: number;
    yearly_percent: number;
  };
  tiers: {
    [key: string]: {
      min_conversions: number;
      monthly_percent: number;
      yearly_percent: number;
    };
  };
}

// HMAC signature verification using Web Crypto API
async function verifySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const signatureBuffer = hexToArrayBuffer(signature);
    if (!signatureBuffer) return false;

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      messageData
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Convert hex string to ArrayBuffer
function hexToArrayBuffer(hex: string): ArrayBuffer | null {
  try {
    const cleanHex = hex.toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]+$/.test(cleanHex) || cleanHex.length % 2 !== 0) {
      return null;
    }
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }
    return bytes.buffer;
  } catch {
    return null;
  }
}

// Get commission rate from config
// deno-lint-ignore no-explicit-any
async function getCommissionRate(
  supabaseClient: any,
  referralCodeId: string,
  plan: string,
  totalConversions: number
): Promise<number> {
  try {
    // Get commission config from database
    const { data: configData } = await supabaseClient
      .from("referral_config")
      .select("config_value")
      .eq("config_key", "commission_rates")
      .single();

    if (!configData?.config_value) {
      console.log("No commission config found, using defaults");
      return plan === "yearly" ? 20 : 50;
    }

    const config = configData.config_value as CommissionConfig;
    const rateKey = plan === "yearly" ? "yearly_percent" : "monthly_percent";
    
    // Start with default rate
    let rate = config.default?.[rateKey] || (plan === "yearly" ? 20 : 50);
    let maxQualifyingConversions = -1;

    // Find the best tier the user qualifies for
    if (config.tiers) {
      for (const [tierName, tierConfig] of Object.entries(config.tiers)) {
        if (totalConversions >= tierConfig.min_conversions && 
            tierConfig.min_conversions > maxQualifyingConversions) {
          maxQualifyingConversions = tierConfig.min_conversions;
          rate = tierConfig[rateKey];
          console.log(`Applying tier ${tierName} with rate ${rate}% for ${totalConversions} conversions`);
        }
      }
    }

    return rate;
  } catch (error) {
    console.error("Error getting commission rate:", error);
    // Fallback to defaults
    return plan === "yearly" ? 20 : 50;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  try {
    // Get the shared secret for HMAC verification
    const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
    if (!internalSecret) {
      console.error("INTERNAL_FUNCTION_SECRET not configured");
      return errorResponse(req, "Server configuration error", 500);
    }

    // Get signature and timestamp from headers
    const signature = req.headers.get("X-Signature");
    const timestampStr = req.headers.get("X-Timestamp");

    if (!signature || !timestampStr) {
      console.warn("Missing authentication headers");
      return errorResponse(req, "Unauthorized: Missing authentication headers", 401);
    }

    // Validate timestamp is within 5 minutes to prevent replay attacks
    const timestamp = parseInt(timestampStr, 10);
    const now = Math.floor(Date.now() / 1000);
    const MAX_TIMESTAMP_DRIFT = 300; // 5 minutes

    if (isNaN(timestamp) || Math.abs(now - timestamp) > MAX_TIMESTAMP_DRIFT) {
      console.warn(`Timestamp validation failed: received=${timestamp}, now=${now}`);
      return errorResponse(req, "Unauthorized: Request expired or invalid timestamp", 401);
    }

    // Read the raw body for signature verification
    const rawBody = await req.text();
    
    // Create the signed payload (timestamp + body)
    const signedPayload = `${timestampStr}.${rawBody}`;

    // Verify HMAC signature
    const isValid = await verifySignature(signedPayload, signature, internalSecret);
    if (!isValid) {
      console.warn("Invalid signature provided");
      return errorResponse(req, "Unauthorized: Invalid signature", 401);
    }

    console.log("Request authenticated successfully");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Parse the verified body
    const { 
      user_id, 
      referral_code, 
      plan, 
      amount, 
      apple_transaction_id,
      source_app 
    } = JSON.parse(rawBody);

    // Validate required fields
    if (!user_id || !referral_code || !plan || !amount) {
      return errorResponse(req, "Missing required fields: user_id, referral_code, plan, amount", 400);
    }

    // Validate UUID format for user_id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(user_id)) {
      return errorResponse(req, "Invalid user_id format", 400);
    }

    // Validate plan
    if (plan !== "monthly" && plan !== "yearly") {
      return errorResponse(req, "Invalid plan. Must be 'monthly' or 'yearly'", 400);
    }

    // Validate amount is a positive number within reasonable bounds
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 10000) {
      return errorResponse(req, "Invalid amount", 400);
    }

    // Look up referral_code_id with current conversion count
    const { data: codeData, error: codeError } = await supabaseClient
      .from("referral_codes")
      .select("id, code, owner_type, total_conversions, tier")
      .eq("code", referral_code.toUpperCase())
      .single();

    if (codeError || !codeData) {
      console.error(`Referral code not found: ${referral_code}`);
      return errorResponse(req, "Referral code not found", 400);
    }

    // Check for duplicate payout (prevent double-counting)
    if (apple_transaction_id) {
      const { data: existingPayout } = await supabaseClient
        .from("referral_payouts")
        .select("id")
        .eq("referral_code_id", codeData.id)
        .eq("apple_transaction_id", apple_transaction_id)
        .maybeSingle();

      if (existingPayout) {
        console.log(`Payout already exists for transaction ${apple_transaction_id}`);
        return jsonResponse(req, { 
          success: true,
          message: "Payout already recorded",
          payout_id: existingPayout.id,
        });
      }
    }

    // Get commission rate from config (tier-based)
    const commissionPercent = await getCommissionRate(
      supabaseClient,
      codeData.id,
      plan,
      codeData.total_conversions || 0
    );
    
    const payoutAmount = numAmount * (commissionPercent / 100);
    const payoutType = plan === "yearly" ? "first_year" : "first_month";

    console.log(`Calculated payout: $${numAmount} x ${commissionPercent}% = $${payoutAmount.toFixed(2)} (tier: ${codeData.tier || 'bronze'})`);

    // Create pending payout
    const { data: newPayout, error: payoutError } = await supabaseClient
      .from("referral_payouts")
      .insert({
        referral_code_id: codeData.id,
        referee_id: user_id,
        amount: payoutAmount,
        status: "pending",
        payout_type: payoutType,
        apple_transaction_id: apple_transaction_id || null,
        created_at: new Date().toISOString(),
        retry_count: 0,
      })
      .select()
      .single();

    if (payoutError) {
      console.error(`Failed to create payout:`, payoutError);
      return errorResponse(req, "Failed to create payout record", 500);
    }

    // Get current metrics and increment them
    const { data: currentData } = await supabaseClient
      .from("referral_codes")
      .select("total_conversions, total_revenue")
      .eq("id", codeData.id)
      .single();

    const newConversionCount = (currentData?.total_conversions || 0) + 1;
    const newRevenue = (currentData?.total_revenue || 0) + payoutAmount;

    // Update with incremented values (tier will be updated by trigger)
    const { error: updateError } = await supabaseClient
      .from("referral_codes")
      .update({ 
        total_conversions: newConversionCount,
        total_revenue: newRevenue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", codeData.id);

    if (updateError) {
      console.error(`Failed to update referral code metrics:`, updateError);
      // Don't fail the whole request, payout was created successfully
    }

    console.log(`Created ${payoutType} payout of $${payoutAmount.toFixed(2)} (${commissionPercent}%) for code ${referral_code} from ${source_app || 'unknown'}`);

    return jsonResponse(req, {
      success: true,
      payout_id: newPayout.id,
      payout_amount: payoutAmount,
      payout_type: payoutType,
      commission_percent: commissionPercent,
      tier: codeData.tier || 'bronze',
      status: "pending",
      message: "Subscription recorded and payout created",
    });

  } catch (error) {
    console.error("Error recording subscription:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(req, errorMessage, 500);
  }
});
