import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAdminRequest } from "../_shared/admin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeJoined<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

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
    const now = new Date().toISOString();

    if (action === "list") {
      const { data, error } = await supabase
        .from("referral_payouts")
        .select(`
          *,
          referral_code:referral_codes!referral_code_id(
            code,
            owner_type,
            owner_user_id,
            influencer_name,
            influencer_email,
            influencer_handle,
            payout_identifier
          ),
          referee:profiles!referee_id(email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const payouts = (data ?? []).map((row: any) => ({
        ...row,
        referral_code: normalizeJoined(row.referral_code),
        referee: normalizeJoined(row.referee),
      }));

      return new Response(JSON.stringify({ payouts }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve" || action === "reject") {
      const payoutId = typeof body?.payoutId === "string" ? body.payoutId : "";
      if (!payoutId) {
        return new Response(JSON.stringify({ error: "Missing payoutId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates = action === "approve"
        ? {
            status: "approved",
            approved_at: now,
            rejected_at: null,
            admin_notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
          }
        : {
            status: "rejected",
            approved_at: null,
            rejected_at: now,
            admin_notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
          };

      const { error } = await supabase
        .from("referral_payouts")
        .update(updates)
        .eq("id", payoutId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "bulk_approve") {
      const referralCodeId = typeof body?.referralCodeId === "string" ? body.referralCodeId : "";
      if (!referralCodeId) {
        return new Response(JSON.stringify({ error: "Missing referralCodeId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabase
        .from("referral_payouts")
        .update({
          status: "approved",
          approved_at: now,
          admin_notes: typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        })
        .eq("referral_code_id", referralCodeId)
        .eq("status", "pending");

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_test_conversion") {
      const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
      const plan = body?.plan === "yearly" ? "yearly" : "monthly";
      const amount = Number(body?.amount ?? (plan === "yearly" ? 99 : 9.99));

      if (!code) {
        return new Response(JSON.stringify({ error: "Missing code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return new Response(JSON.stringify({ error: "Invalid amount" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: codeData, error: codeError } = await supabase
        .from("referral_codes")
        .select("id, code, owner_user_id, total_conversions, total_revenue")
        .eq("code", code)
        .maybeSingle();

      if (codeError) throw codeError;

      if (!codeData) {
        return new Response(JSON.stringify({ error: "Referral code not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payoutType = plan === "yearly" ? "first_year" : "first_month";
      const commissionPercent = plan === "yearly" ? 20 : 50;
      const payoutAmount = Number((amount * (commissionPercent / 100)).toFixed(2));
      const refereeId = isUuid(body?.refereeId) ? body.refereeId : adminRequest.userId;

      const { data: payout, error: payoutError } = await supabase
        .from("referral_payouts")
        .insert({
          referral_code_id: codeData.id,
          referrer_id: codeData.owner_user_id ?? adminRequest.userId,
          referee_id: refereeId,
          amount: payoutAmount,
          payout_type: payoutType,
          status: "pending",
          retry_count: 0,
        })
        .select("*")
        .maybeSingle();

      if (payoutError) throw payoutError;

      const { error: updateError } = await supabase
        .from("referral_codes")
        .update({
          total_conversions: (codeData.total_conversions ?? 0) + 1,
          total_revenue: Number(codeData.total_revenue ?? 0) + amount,
          updated_at: now,
        })
        .eq("id", codeData.id);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        payout,
        payout_amount: payoutAmount,
        commission_percent: commissionPercent,
        payout_type: payoutType,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("manage-referral-payouts error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
