import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  clamp,
  computeNextRequestFatigue,
  computeRitualTargetCount,
  computeRoutineStability,
  determineEmotionalArc,
} from "../_shared/companionLife.ts";
import { requireRequestAuth } from "../_shared/auth.ts";

interface DayTickBody {
  date?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return handleCors(req);

  const corsHeaders = getCorsHeaders(req);

  try {
    const authResult = await requireRequestAuth(req, corsHeaders);
    if (authResult instanceof Response) return authResult;

    const { userId } = authResult;
    const body = (await req.json().catch(() => ({}))) as DayTickBody;
    const requestedDate = body.date ? new Date(body.date) : new Date();
    const ritualDate = Number.isNaN(requestedDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : requestedDate.toISOString().slice(0, 10);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, care_score, care_consistency, request_fatigue, routine_stability_score, dormant_since")
      .eq("user_id", userId)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companion) {
      return new Response(JSON.stringify({ error: "Companion not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const careScore = clamp(Number(companion.care_score ?? 0.5), 0, 1);
    const careConsistency = clamp(Number(companion.care_consistency ?? 0.5), 0, 1);
    const priorStability = clamp(Number(companion.routine_stability_score ?? 50), 0, 100);
    const requestFatigue = clamp(Number(companion.request_fatigue ?? 0), 0, 10);

    const routineStabilityScore = computeRoutineStability({
      careScore,
      careConsistency,
      requestFatigue,
      priorStability,
      isDormant: Boolean(companion.dormant_since),
    });
    const nextFatigue = computeNextRequestFatigue({
      careScore,
      careConsistency,
      requestFatigue,
      isDormant: Boolean(companion.dormant_since),
    });
    const currentEmotionalArc = determineEmotionalArc({
      careScore,
      routineStability: routineStabilityScore,
      requestFatigue: nextFatigue,
      isDormant: Boolean(companion.dormant_since),
    });

    const { data: ritualDefs, error: ritualDefsError } = await supabase
      .from("companion_ritual_defs")
      .select("id, code")
      .eq("active", true)
      .order("cooldown_hours", { ascending: true })
      .order("code", { ascending: true });

    if (ritualDefsError) throw ritualDefsError;

    const ritualTargetCount = computeRitualTargetCount(careScore, careConsistency);
    const selectedDefs = (ritualDefs ?? []).slice(0, ritualTargetCount);
    const ritualPressure = (1 - careScore) + (1 - careConsistency) * 0.6 + nextFatigue * 0.08;

    const ritualRows = selectedDefs.map((def, index) => ({
      user_id: userId,
      companion_id: companion.id,
      ritual_def_id: def.id,
      ritual_date: ritualDate,
      status: "pending",
      urgency: index === 0 && ritualPressure >= 1.1
        ? "critical"
        : index < 2 && ritualPressure >= 0.72
          ? "important"
          : "gentle",
    }));

    if (ritualRows.length > 0) {
      const { error: ritualUpsertError } = await supabase
        .from("companion_daily_rituals")
        .upsert(ritualRows, {
          onConflict: "user_id,companion_id,ritual_def_id,ritual_date",
        });

      if (ritualUpsertError) throw ritualUpsertError;
    }

    const { error: updateError } = await supabase
      .from("user_companion")
      .update({
        current_emotional_arc: currentEmotionalArc,
        routine_stability_score: routineStabilityScore,
        request_fatigue: nextFatigue,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companion.id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({
      success: true,
      ritualDate,
      ritualCount: ritualRows.length,
      currentEmotionalArc,
      routineStabilityScore,
      requestFatigue: nextFatigue,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[process-companion-day-tick]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
