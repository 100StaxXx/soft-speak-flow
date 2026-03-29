import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  errorResponse,
  requireAdminOrServiceRole,
  type RequestAuth,
} from "../_shared/auth.ts";

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

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_HOURS = 24;

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

interface RetryFailedPayoutsDeps {
  authorize: (req: Request, corsHeaders: HeadersInit, supabase: any) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
}

const defaultDeps: RetryFailedPayoutsDeps = {
  authorize: (req, responseCorsHeaders, supabase) =>
    requireAdminOrServiceRole(req, responseCorsHeaders, supabase),
  createSupabaseClient: () =>
    createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    ),
  fetchImpl: fetch,
};

const getPayPalEnvironment = (): "sandbox" | "production" => {
  const env = Deno.env.get("PAYPAL_ENVIRONMENT") || "sandbox";
  return env.toLowerCase() === "production" ? "production" : "sandbox";
};

const getPayPalApiUrl = (): string => {
  return getPayPalEnvironment() === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
};

// deno-lint-ignore no-explicit-any
function castPayout(payout: any): FailedPayout {
  return {
    id: payout.id,
    amount: payout.amount,
    retry_count: payout.retry_count,
    failure_reason: payout.failure_reason,
    referral_code: Array.isArray(payout.referral_code) ? payout.referral_code[0] : payout.referral_code,
  };
}

export async function handleRetryFailedPayouts(
  req: Request,
  deps: RetryFailedPayoutsDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = deps.createSupabaseClient();

    const requestAuth = await deps.authorize(req, corsHeaders, supabaseClient);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    console.log("Starting retry of failed payouts...");

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
      return errorResponse(500, "Failed to fetch payouts", corsHeaders);
    }

    if (!failedPayouts || failedPayouts.length === 0) {
      console.log("No failed payouts to retry");
      return new Response(
        JSON.stringify({ success: true, message: "No failed payouts to retry", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`Found ${failedPayouts.length} failed payouts to retry`);

    const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const clientSecret = Deno.env.get("PAYPAL_SECRET");

    if (!clientId || !clientSecret) {
      console.error("PayPal credentials not configured");
      return errorResponse(500, "PayPal credentials not configured", corsHeaders);
    }

    const paypalBaseUrl = getPayPalApiUrl();
    const paypalEnv = getPayPalEnvironment();
    console.log(`Using PayPal ${paypalEnv} environment`);

    const basicAuth = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await deps.fetchImpl(`${paypalBaseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      console.error("PayPal auth failed:", await tokenResponse.text());
      return errorResponse(500, "PayPal authentication failed", corsHeaders);
    }

    const { access_token } = await tokenResponse.json();
    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const rawPayout of failedPayouts) {
      const payout = castPayout(rawPayout);
      const paypalEmail = payout.referral_code?.payout_identifier || payout.referral_code?.influencer_email;

      if (!paypalEmail) {
        console.log(`Skipping payout ${payout.id}: no PayPal email`);

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
              note: "Cosmiq Referral Reward (Retry)",
              sender_item_id: payout.id,
            },
          ],
        };

        const payoutResponse = await deps.fetchImpl(`${paypalBaseUrl}/v1/payments/payouts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access_token}`,
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

          results.push({ id: payout.id, success: false, error: `PayPal error: ${errorText}` });
          continue;
        }

        const payoutData = await payoutResponse.json();
        const payoutBatchId = payoutData.batch_header?.payout_batch_id;
        const batchStatus = payoutData.batch_header?.batch_status;

        console.log(`PayPal retry initiated for ${payout.id}: batch=${payoutBatchId}, status=${batchStatus}`);

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

    const successCount = results.filter((result) => result.success).length;
    const failCount = results.filter((result) => !result.success).length;

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
      },
    );
  } catch (error) {
    console.error("Error in retry-failed-payouts:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return errorResponse(500, errorMessage, corsHeaders);
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleRetryFailedPayouts(req));
}
