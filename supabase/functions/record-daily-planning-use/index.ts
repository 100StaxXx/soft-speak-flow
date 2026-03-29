import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireRequestAuth } from "../_shared/auth.ts";

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

    const requestAuth = await requireRequestAuth(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    const body = await req.json().catch(() => ({}));
    const increment = body?.increment === true;
    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await supabase
      .from("daily_planning_usage")
      .select("times_used, last_used_at")
      .eq("user_id", requestAuth.userId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    const nextCount = increment ? Number(existing?.times_used ?? 0) + 1 : Number(existing?.times_used ?? 0);
    const nextLastUsedAt = increment ? now : existing?.last_used_at ?? null;

    const { data, error } = await supabase
      .from("daily_planning_usage")
      .upsert({
        user_id: requestAuth.userId,
        times_used: nextCount,
        last_used_at: nextLastUsedAt,
      }, {
        onConflict: "user_id",
      })
      .select("times_used, last_used_at")
      .single();

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({
      success: true,
      times_used: data.times_used,
      last_used_at: data.last_used_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("record-daily-planning-use error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
