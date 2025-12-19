import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

/**
 * Record Subscription from alilpush
 * 
 * Called by alilpush after successful Apple IAP purchase.
 * Creates a pending payout for the referrer and updates conversion metrics.
 * 
 * SECURITY: This endpoint requires HMAC signature verification.
 * The caller must include an X-Signature header with HMAC-SHA256 of the request body.
 * 
 * Request headers:
 *   X-Signature: HMAC-SHA256 signature of JSON body using INTERNAL_FUNCTION_SECRET
 *   X-Timestamp: Unix timestamp (must be within 5 minutes)
 * 
 * Request body:
 * {
 *   user_id: string - UUID of the user who subscribed (from alilpush)
 *   referral_code: string - The referral code that referred this user
 *   plan: string - "monthly" or "yearly"
 *   amount: number - Subscription amount in USD
 *   apple_transaction_id?: string - Optional for deduplication
 *   source_app: string - Which app the purchase came from ("alilpush")
 * }
 */

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

    // Look up referral_code_id
    const { data: codeData, error: codeError } = await supabaseClient
      .from("referral_codes")
      .select("id, code, owner_type")
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

    // Calculate commission
    const payoutAmount = plan === "yearly" ? numAmount * 0.20 : numAmount * 0.50;
    const payoutType = plan === "yearly" ? "first_year" : "first_month";

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

    // Update with incremented values
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

    console.log(`Created ${payoutType} payout of $${payoutAmount.toFixed(2)} for code ${referral_code} from ${source_app || 'unknown'}`);

    return jsonResponse(req, {
      success: true,
      payout_id: newPayout.id,
      payout_amount: payoutAmount,
      payout_type: payoutType,
      status: "pending",
      message: "Subscription recorded and payout created",
    });

  } catch (error) {
    console.error("Error recording subscription:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(req, errorMessage, 500);
  }
});
