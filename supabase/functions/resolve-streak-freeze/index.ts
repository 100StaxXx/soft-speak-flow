import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();

    if (!action || !["use_freeze", "reset_streak"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be 'use_freeze' or 'reset_streak'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_habit_streak, streak_freezes_available, streak_at_risk")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[Resolve Freeze] Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.streak_at_risk) {
      return new Response(
        JSON.stringify({ error: "No streak at risk", streakPreserved: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: { streakPreserved: boolean; newStreak: number; freezesRemaining: number };

    if (action === "use_freeze") {
      // Check if user has freezes available
      if ((profile.streak_freezes_available ?? 0) <= 0) {
        return new Response(
          JSON.stringify({ error: "No freezes available" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use freeze: preserve streak, consume freeze, clear at_risk
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          streak_at_risk: false,
          streak_at_risk_since: null,
          streak_freezes_available: Math.max(0, (profile.streak_freezes_available ?? 1) - 1),
          last_streak_freeze_used: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[Resolve Freeze] Update error:", updateError);
        throw updateError;
      }

      console.log(`[Resolve Freeze] User ${user.id} used freeze to preserve ${profile.current_habit_streak} day streak`);

      result = {
        streakPreserved: true,
        newStreak: profile.current_habit_streak ?? 0,
        freezesRemaining: Math.max(0, (profile.streak_freezes_available ?? 1) - 1),
      };
    } else {
      // Reset streak: set to 0, clear at_risk
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          streak_at_risk: false,
          streak_at_risk_since: null,
          current_habit_streak: 0,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[Resolve Freeze] Update error:", updateError);
        throw updateError;
      }

      console.log(`[Resolve Freeze] User ${user.id} let ${profile.current_habit_streak} day streak reset`);

      result = {
        streakPreserved: false,
        newStreak: 0,
        freezesRemaining: profile.streak_freezes_available ?? 0,
      };
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Resolve Freeze] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
