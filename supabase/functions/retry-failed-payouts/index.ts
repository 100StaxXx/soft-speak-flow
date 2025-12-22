import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Retry Failed Payouts
 * 
 * Scheduled function to retry failed PayPal payouts.
 * Processes payouts that have failed but haven't exceeded max retry attempts.
 * Can be triggered by a cron job or manually by an admin.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Default settings
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_HOURS = 24;

// Get PayPal environment
const getPayPalEnvironment = (): "sandbox" | "production" => {
  const env = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";
  return env.toLowerCase() === "production" ? "production" : "sandbox";
};

const getPayPalApiUrl = (): string => {
  return getPayPalEnvironment() === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
};

interface PayoutSettings {
  minimum_threshold: number;
  auto_approve_threshold: number;
  max_retry_attempts: number;
  retry_delay_hours: number;
}

interface FailedPayout {
  id: string;
  amount: number;
  retry_count: number;
  failure_reason: string | null;
  referral_code: {
    payout_identifier: string;
    influencer_email: string;
    code: string;
  } | null;
}

// deno-lint-ignore no-explicit-any
function castPayout(p: any): FailedPayout {
  return {
    id: p.id,
    amount: p.amount,
    retry_count: p.retry_count,
    failure_reason: p.failure_reason,
    referral_code: Array.isArray(p.referral_code) ? p.referral_code[0] : p.referral_code,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("Starting retry of failed payouts...");

    // Get payout settings from config
    const { data: configData } = await supabaseClient
      .from("referral_config")
      .select("config_value")
      .eq("config_key", "payout_settings")
      .single();

    const settings: PayoutSettings = configData?.config_value || {
      minimum_threshold: 50,
      auto_approve_threshold: 100,
      max_retry_attempts: DEFAULT_MAX_RETRIES,
      retry_delay_hours: DEFAULT_RETRY_DELAY_HOURS,
    };

    console.log(`Settings: max retries=${settings.max_retry_attempts}, delay=${settings.retry_delay_hours}h`);

    // Find failed payouts that are due for retry
    const { data: failedPayouts, error: fetchError } = await supabaseClient
      .from("referral_payouts")
      .select(`
        id,
        amount,
        retry_count,
        failure_reason,
        referral_code:referral_codes!referral_code_id(
          payout_identifier,
          influencer_email,
          code
        )
      `)
      .eq("status", "failed")
      .lt("retry_count", settings.max_retry_attempts)
      .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`);

    if (fetchError) {
      console.error("Error fetching failed payouts:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch payouts" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!failedPayouts || failedPayouts.length === 0) {
      console.log("No failed payouts to retry");
      return new Response(
        JSON.stringify({ success: true, message: "No failed payouts to retry", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${failedPayouts.length} failed payouts to retry`);

    // Get PayPal credentials
    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_SECRET");

    if (!clientId || !clientSecret) {
      console.error("PayPal credentials not configured");
      return new Response(JSON.stringify({ error: "PayPal credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paypalBaseUrl = getPayPalApiUrl();
    const paypalEnv = getPayPalEnvironment();
    console.log(`Using PayPal ${paypalEnv} environment`);

    // Get PayPal access token
    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      console.error("PayPal auth failed:", await tokenResponse.text());
      return new Response(JSON.stringify({ error: "PayPal authentication failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { access_token } = await tokenResponse.json();

    const results: { id: string; success: boolean; error?: string }[] = [];

    // Process each failed payout
    for (const rawPayout of failedPayouts) {
      const payout = castPayout(rawPayout);
      const paypalEmail = payout.referral_code?.payout_identifier || payout.referral_code?.influencer_email;
      
      if (!paypalEmail) {
        console.log(`Skipping payout ${payout.id}: no PayPal email`);
        
        // Mark as permanently failed
        await supabaseClient
          .from("referral_payouts")
          .update({
            retry_count: settings.max_retry_attempts,
            failure_reason: "No PayPal email configured",
            last_retry_at: new Date().toISOString(),
          })
          .eq("id", payout.id);

        results.push({ id: payout.id, success: false, error: "No PayPal email" });
        continue;
      }

      console.log(`Retrying payout ${payout.id} (attempt ${payout.retry_count + 1}/${settings.max_retry_attempts})`);

      try {
        // Create PayPal payout
        const payoutBatch = {
          sender_batch_header: {
            sender_batch_id: `retry_${payout.id}_${Date.now()}`,
            email_subject: "You've received a referral reward from Cosmiq!",
            email_message: "Thank you for referring friends to Cosmiq. Here's your reward!",
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: {
                value: Number(payout.amount).toFixed(2),
                currency: "USD",
              },
              receiver: paypalEmail,
              note: `Cosmiq Referral Reward (Retry)`,
              sender_item_id: payout.id,
            },
          ],
        };

        const payoutResponse = await fetch(`${paypalBaseUrl}/v1/payments/payouts`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payoutBatch),
        });

        if (!payoutResponse.ok) {
          const errorText = await payoutResponse.text();
          console.error(`PayPal payout retry failed for ${payout.id}:`, errorText);

          const newRetryCount = payout.retry_count + 1;
          const nextRetryAt = newRetryCount < settings.max_retry_attempts
            ? new Date(Date.now() + settings.retry_delay_hours * 60 * 60 * 1000).toISOString()
            : null;

          await supabaseClient
            .from("referral_payouts")
            .update({
              retry_count: newRetryCount,
              last_retry_at: new Date().toISOString(),
              next_retry_at: nextRetryAt,
              failure_reason: `PayPal error: ${errorText.substring(0, 500)}`,
            })
            .eq("id", payout.id);

          results.push({ id: payout.id, success: false, error: "PayPal API error" });
          continue;
        }

        const payoutResult = await payoutResponse.json();
        const payoutBatchId = payoutResult.batch_header?.payout_batch_id;
        const batchStatus = payoutResult.batch_header?.batch_status;

        console.log(`Retry successful for ${payout.id}: batch ${payoutBatchId}, status ${batchStatus}`);

        // Update payout status
        await supabaseClient
          .from("referral_payouts")
          .update({
            status: batchStatus === "SUCCESS" ? "paid" : "processing",
            paid_at: batchStatus === "SUCCESS" ? new Date().toISOString() : null,
            paypal_transaction_id: payoutBatchId,
            retry_count: payout.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            next_retry_at: null,
            failure_reason: null,
            admin_notes: `Retry ${payout.retry_count + 1} successful: ${payoutBatchId}`,
          })
          .eq("id", payout.id);

        results.push({ id: payout.id, success: true });

      } catch (error) {
        console.error(`Error processing retry for ${payout.id}:`, error);
        
        const newRetryCount = payout.retry_count + 1;
        const nextRetryAt = newRetryCount < settings.max_retry_attempts
          ? new Date(Date.now() + settings.retry_delay_hours * 60 * 60 * 1000).toISOString()
          : null;

        await supabaseClient
          .from("referral_payouts")
          .update({
            retry_count: newRetryCount,
            last_retry_at: new Date().toISOString(),
            next_retry_at: nextRetryAt,
            failure_reason: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", payout.id);

        results.push({ id: payout.id, success: false, error: error instanceof Error ? error.message : "Unknown" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Retry complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} failed payouts`,
        processed: results.length,
        succeeded: successCount,
        failed: failCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in retry-failed-payouts:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
