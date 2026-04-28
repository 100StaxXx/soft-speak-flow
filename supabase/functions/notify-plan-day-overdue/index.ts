import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireInternalRequest } from "../_shared/auth.ts";
import { parseIntEnv } from "../_shared/notificationsV2.ts";
import {
  buildOverduePushes,
  type DailyPlanRow,
  type DayPlanBlockRecord,
  type OverdueProfile,
} from "./planDayOverdue.ts";

interface RawDailyPlanRow {
  id: string;
  user_id: string;
  plan_date: string;
  status: string;
  blocks: unknown;
  updated_at: string | null;
}

const normalizeBlocks = (raw: unknown): DayPlanBlockRecord[] => {
  if (!Array.isArray(raw)) return [];
  const blocks: DayPlanBlockRecord[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    if (!id) continue;
    const title = typeof record.title === "string" ? record.title : "Quest";
    const startTime = typeof record.startTime === "string"
      ? record.startTime
      : null;
    const durationMinutes = typeof record.durationMinutes === "number"
      ? record.durationMinutes
      : 30;
    const questId = typeof record.questId === "string" ? record.questId : null;
    const source = typeof record.source === "string" ? record.source : null;
    blocks.push({ id, title, startTime, durationMinutes, questId, source });
  }
  return blocks;
};

const normalizeDailyPlanRow = (raw: RawDailyPlanRow): DailyPlanRow | null => {
  if (raw.status !== "committed" && raw.status !== "draft") return null;
  return {
    id: raw.id,
    user_id: raw.user_id,
    plan_date: raw.plan_date,
    status: raw.status,
    blocks: normalizeBlocks(raw.blocks),
    updated_at: raw.updated_at ?? null,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireInternalRequest(req, corsHeaders);
    if (auth instanceof Response) return auth;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const planScanLimit = parseIntEnv(
      "PLAN_DAY_OVERDUE_PLAN_SCAN_LIMIT",
      500,
    );
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    const today = now.toISOString().slice(0, 10);
    const yesterday =
      new Date(now.getTime() - 24 * 60 * 60_000).toISOString().slice(0, 10);

    const { data: rawPlans, error: plansError } = await supabase
      .from("daily_plans")
      .select("id, user_id, plan_date, status, blocks, updated_at")
      .eq("status", "committed")
      .in("plan_date", [today, yesterday])
      .order("updated_at", { ascending: false })
      .limit(planScanLimit);
    if (plansError) {
      throw new Error(`Failed to load daily_plans: ${plansError.message}`);
    }

    const plans: DailyPlanRow[] = ((rawPlans as RawDailyPlanRow[] | null) ?? [])
      .map(normalizeDailyPlanRow)
      .filter((row): row is DailyPlanRow => row !== null && row.blocks.length > 0);

    if (plans.length === 0) {
      return new Response(
        JSON.stringify({ scanned: 0, queued: 0, skipped_unknown_user: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userIds = Array.from(new Set(plans.map((plan) => plan.user_id)));
    const { data: rawProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, timezone, task_reminders_enabled")
      .in("id", userIds);
    if (profilesError) {
      throw new Error(`Failed to load profiles: ${profilesError.message}`);
    }
    const profiles = new Map<string, OverdueProfile>();
    for (const row of (rawProfiles as OverdueProfile[] | null) ?? []) {
      profiles.set(row.id, row);
    }

    const questIds = new Set<string>();
    for (const plan of plans) {
      for (const block of plan.blocks) {
        if (typeof block.questId === "string" && block.questId.length > 0) {
          questIds.add(block.questId);
        }
      }
    }
    const completedQuestIds = new Set<string>();
    if (questIds.size > 0) {
      const { data: rawTasks, error: tasksError } = await supabase
        .from("daily_tasks")
        .select("id, completed")
        .in("id", Array.from(questIds));
      if (tasksError) {
        throw new Error(`Failed to load daily_tasks: ${tasksError.message}`);
      }
      for (
        const task of (rawTasks as Array<{ id: string; completed: boolean }>
          | null) ?? []
      ) {
        if (task.completed) completedQuestIds.add(task.id);
      }
    }

    const queueRows = buildOverduePushes({
      plans,
      profiles,
      completedQuestIds,
      now,
    });

    let queued = 0;
    if (queueRows.length > 0) {
      const { error: insertError } = await supabase
        .from("push_notification_queue")
        .upsert(queueRows, {
          onConflict: "dedupe_key",
          ignoreDuplicates: true,
        });
      if (insertError) {
        console.error(
          "[notify-plan-day-overdue] queue upsert failed",
          insertError.message,
        );
      } else {
        queued = queueRows.length;
      }
    }

    console.log("[notify-plan-day-overdue] scan_complete", {
      plans_scanned: plans.length,
      profiles_resolved: profiles.size,
      overdue_users: queueRows.length,
      queued,
    });

    return new Response(
      JSON.stringify({
        scanned: plans.length,
        queued,
        skipped_unknown_user: plans.length - profiles.size,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[notify-plan-day-overdue] fatal:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
