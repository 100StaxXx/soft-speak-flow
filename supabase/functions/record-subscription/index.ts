import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Record Subscription from alilpush
 * 
 * Called by alilpush after successful Apple IAP purchase.
 * Creates a pending payout for the referrer and updates conversion metrics.
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { 
      user_id, 
      referral_code, 
      plan, 
      amount, 
      apple_transaction_id,
      source_app 
    } = await req.json();

    // Validate required fields
    if (!user_id || !referral_code || !plan || !amount) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Missing required fields: user_id, referral_code, plan, amount" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate plan
    if (plan !== "monthly" && plan !== "yearly") {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid plan. Must be 'monthly' or 'yearly'" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Look up referral_code_id
    const { data: codeData, error: codeError } = await supabaseClient
      .from("referral_codes")
      .select("id, code, owner_type")
      .eq("code", referral_code.toUpperCase())
      .single();

    if (codeError || !codeData) {
      console.error(`Referral code not found: ${referral_code}`);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Referral code not found" 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
        return new Response(
          JSON.stringify({ 
            success: true,
            message: "Payout already recorded",
            payout_id: existingPayout.id,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Calculate commission
    const payoutAmount = plan === "yearly" ? amount * 0.20 : amount * 0.50;
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
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to create payout record" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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

    return new Response(
      JSON.stringify({
        success: true,
        payout_id: newPayout.id,
        payout_amount: payoutAmount,
        payout_type: payoutType,
        status: "pending",
        message: "Subscription recorded and payout created",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error recording subscription:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
