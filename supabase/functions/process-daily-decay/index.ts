import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireInternalRequest } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CompanionActivityState {
  id: string;
  user_id: string;
  inactive_days: number | null;
  last_7_days_activity: boolean[] | null;
}

const getUtcDateStamp = (date: Date): string => date.toISOString().slice(0, 10);

export async function handleProcessDailyCompanionState(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const auth = await requireInternalRequest(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const hadMeaningfulActivity = async (userId: string, date: string): Promise<boolean> => {
      const start = `${date}T00:00:00.000Z`;
      const endDate = new Date(start);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const end = endDate.toISOString();

      const [tasks, habits, checkIns, missionThreads] = await Promise.all([
        supabase
          .from("daily_tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("completed", true)
          .gte("completed_at", start)
          .lt("completed_at", end),
        supabase
          .from("habit_completions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("date", date),
        supabase
          .from("daily_check_ins")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("check_in_date", date),
        supabase
          .from("daily_mission_threads")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("mission_date", date)
          .in("status", ["completed", "reflected"]),
      ]);

      for (const result of [tasks, habits, checkIns, missionThreads]) {
        if (result.error) throw result.error;
      }

      return [tasks.count, habits.count, checkIns.count, missionThreads.count]
        .some((count) => (count ?? 0) > 0);
    };
    const todayDate = new Date();
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const today = getUtcDateStamp(todayDate);
    const yesterday = getUtcDateStamp(yesterdayDate);

    const { data, error } = await supabase
      .from("user_companion")
      .select("id, user_id, inactive_days, last_7_days_activity");
    if (error) throw error;

    let activeCount = 0;
    let restingCount = 0;
    let failedCount = 0;

    for (const companion of (data ?? []) as CompanionActivityState[]) {
      try {
        const wasActive = await hadMeaningfulActivity(companion.user_id, yesterday);
        const recentActivity = companion.last_7_days_activity ?? [];
        const updatedActivity = [wasActive, ...recentActivity.slice(0, 6)];
        const consistency = updatedActivity.filter(Boolean).length / 7;

        const update = wasActive
          ? {
              inactive_days: 0,
              last_activity_date: today,
              current_mood: "happy",
              care_consistency: Math.max(0.5, consistency),
            }
          : {
              inactive_days: (companion.inactive_days ?? 0) + 1,
              current_mood: "content",
              care_consistency: Math.max(0.35, consistency),
            };

        const { error: updateError } = await supabase
          .from("user_companion")
          .update({
            ...update,
            is_alive: true,
            dormant_since: null,
            dormancy_recovery_days: 0,
            recovery_progress: 100,
            hunger: 100,
            happiness: 100,
            care_score: 100,
            last_7_days_activity: updatedActivity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", companion.id)
          .eq("user_id", companion.user_id);
        if (updateError) throw updateError;

        if (wasActive) activeCount += 1;
        else restingCount += 1;
      } catch (companionError) {
        failedCount += 1;
        console.error("[Daily Companion State] Companion update failed", {
          companionId: companion.id,
          error: companionError instanceof Error ? companionError.message : String(companionError),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: failedCount === 0,
        processed: (data ?? []).length,
        active: activeCount,
        resting: restingCount,
        failed: failedCount,
        policy: "warm_presence_v1",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[Daily Companion State] Processing failed", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

serve(handleProcessDailyCompanionState);
