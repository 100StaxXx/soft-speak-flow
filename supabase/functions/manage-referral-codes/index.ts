import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdminRequest } from "../_shared/admin.ts";
import { syncAppleOfferCodeForReferralCode } from "../_shared/referralState.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const adminRequest = await requireAdminRequest(req, supabase, corsHeaders);
    if (adminRequest instanceof Response) {
      return adminRequest;
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "list";

    if (action === "list") {
      const { data: codes, error } = await supabase
        .from("referral_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const codesWithStats = await Promise.all((codes ?? []).map(async (code: any) => {
        const [{ count: conversionCount }, { data: payouts }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("referred_by_code", code.code),
          supabase
            .from("referral_payouts")
            .select("amount")
            .eq("referral_code_id", code.id),
        ]);

        return {
          ...code,
          conversion_count: conversionCount || 0,
          total_earnings: (payouts ?? []).reduce((sum: number, payout: any) => sum + Number(payout.amount), 0),
        };
      }));

      return new Response(JSON.stringify({ codes: codesWithStats }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle") {
      const codeId = typeof body?.codeId === "string" ? body.codeId : "";
      const isActive = body?.isActive === true;
      if (!codeId) {
        return new Response(JSON.stringify({ error: "Missing codeId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("referral_codes")
        .update({ is_active: !isActive })
        .eq("id", codeId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resync_apple_offer_codes") {
      const codeFilter = typeof body?.code === "string" ? body.code.trim().toUpperCase() : null;
      let query = supabase
        .from("referral_codes")
        .select("id, code, apple_offer_code_id, apple_offer_campaign_identifier")
        .eq("owner_type", "influencer")
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (codeFilter) {
        query = query.eq("code", codeFilter);
      }

      const { data: codes, error } = await query;
      if (error) throw error;

      const results = [];
      for (const code of codes ?? []) {
        results.push(await syncAppleOfferCodeForReferralCode(supabase, {
          id: code.id,
          code: code.code,
          apple_offer_code_id: code.apple_offer_code_id ?? null,
          apple_offer_campaign_identifier: code.apple_offer_campaign_identifier ?? null,
        }));
      }

      const synced = results.filter((result) => result.status === "active").length;
      const failed = results.filter((result) => result.status === "failed").length;

      return new Response(JSON.stringify({
        success: failed === 0,
        total: results.length,
        synced,
        failed,
        results,
      }), {
        status: failed === 0 ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-referral-codes error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
