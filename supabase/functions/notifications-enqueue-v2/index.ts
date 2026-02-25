import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { requireRequestAuth } from "../_shared/auth.ts";
import {
  computeDeterministicJitterMinutes,
  getLocalDateTimeParts,
  getLocalWeekdayIndex,
  getNotificationPriority,
  normalizeTimezone,
  parseIntEnv,
  type NotificationType,
} from "../_shared/notificationsV2.ts";
import { composeNotificationCopy, type CompanionNotificationContext } from "../_shared/notificationComposer.ts";

interface QueueInsertRow {
  user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  scheduled_for: string;
  context: Record<string, unknown>;
  payload: Record<string, unknown>;
  status: "queued";
  source_table: string;
  source_id: string;
  dedupe_key: string;
  priority: number;
  delivered: boolean;
}

interface ProfileRow {
  id: string;
  timezone: string | null;
  daily_push_enabled?: boolean | null;
  task_reminders_enabled?: boolean | null;
  habit_reminders_enabled?: boolean | null;
  checkin_reminders_enabled?: boolean | null;
}

interface CompanionRow {
  user_id: string;
  cached_creature_name: string | null;
  spirit_animal: string | null;
  current_mood: string | null;
  inactive_days: number | null;
}

function toScheduledDateTime(taskDate: string | null, scheduledTime: string | null): Date | null {
  if (!taskDate || !scheduledTime) return null;
  const timePart = scheduledTime.split(".")[0];
  const value = new Date(`${taskDate}T${timePart}Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function toCompanionMap(rows: CompanionRow[] | null): Map<string, CompanionNotificationContext> {
  const map = new Map<string, CompanionNotificationContext>();
  for (const row of rows ?? []) {
    map.set(row.user_id, {
      cachedCreatureName: row.cached_creature_name,
      spiritAnimal: row.spirit_animal,
      currentMood: row.current_mood,
      inactiveDays: row.inactive_days,
    });
  }
  return map;
}

function rowForQueue(input: {
  userId: string;
  type: NotificationType;
  sourceTable: string;
  sourceId: string;
  dedupeKey: string;
  scheduledFor: string;
  payload: Record<string, unknown>;
  companion?: CompanionNotificationContext | null;
}): QueueInsertRow {
  const copy = composeNotificationCopy({
    type: input.type,
    payload: input.payload,
    companion: input.companion,
  });

  return {
    user_id: input.userId,
    notification_type: input.type,
    title: copy.title,
    body: copy.body,
    scheduled_for: input.scheduledFor,
    context: {
      source_table: input.sourceTable,
      source_id: input.sourceId,
    },
    payload: input.payload,
    status: "queued",
    source_table: input.sourceTable,
    source_id: input.sourceId,
    dedupe_key: input.dedupeKey,
    priority: getNotificationPriority(input.type),
    delivered: false,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const auth = await requireRequestAuth(req, corsHeaders);
    if (auth instanceof Response) {
      return auth;
    }

    if (!auth.isServiceRole) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    const maxPep = parseIntEnv("NOTIFICATIONS_V2_PEP_SCAN_LIMIT", 300);
    const maxTask = parseIntEnv("NOTIFICATIONS_V2_TASK_SCAN_LIMIT", 400);
    const maxHabit = parseIntEnv("NOTIFICATIONS_V2_HABIT_SCAN_LIMIT", 200);
    const maxContact = parseIntEnv("NOTIFICATIONS_V2_CONTACT_SCAN_LIMIT", 200);
    const maxNudge = parseIntEnv("NOTIFICATIONS_V2_NUDGE_SCAN_LIMIT", 200);
    const maxProfiles = parseIntEnv("NOTIFICATIONS_V2_PROFILE_SCAN_LIMIT", 300);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();
    const nowIso = now.toISOString();
    const todayIso = nowIso.slice(0, 10);

    const inserts: QueueInsertRow[] = [];

    // 1) Daily pep talk notifications
    const { data: duePepPushes, error: pepError } = await supabase
      .from("user_daily_pushes")
      .select(`
        id,
        user_id,
        daily_pep_talk_id,
        scheduled_at,
        daily_pep_talks (
          title,
          summary,
          mentor_slug
        )
      `)
      .is("delivered_at", null)
      .lte("scheduled_at", nowIso)
      .limit(maxPep);

    if (pepError) throw pepError;

    const pepUserIds = [...new Set((duePepPushes ?? []).map((row) => row.user_id as string))];
    const companionMap = pepUserIds.length > 0
      ? toCompanionMap((await supabase
        .from("user_companion")
        .select("user_id, cached_creature_name, spirit_animal, current_mood, inactive_days")
        .in("user_id", pepUserIds)).data as CompanionRow[] | null)
      : new Map<string, CompanionNotificationContext>();

    for (const push of duePepPushes ?? []) {
      const pepTalk = Array.isArray(push.daily_pep_talks) ? push.daily_pep_talks[0] : push.daily_pep_talks;
      inserts.push(rowForQueue({
        userId: push.user_id,
        type: "daily_pep",
        sourceTable: "user_daily_pushes",
        sourceId: push.id,
        dedupeKey: `daily_pep:${push.id}`,
        scheduledFor: push.scheduled_at ?? nowIso,
        payload: {
          pep_talk_id: push.daily_pep_talk_id,
          title: pepTalk?.title ?? "Your daily pep talk",
          summary: pepTalk?.summary ?? "Your daily pep talk is ready.",
          mentor_slug: pepTalk?.mentor_slug ?? null,
          type: "daily_pep",
          url: "/pep-talks",
        },
        companion: companionMap.get(push.user_id) ?? null,
      }));
    }

    // 2) Task start + reminder notifications
    const { data: taskCandidates, error: taskError } = await supabase
      .from("daily_tasks")
      .select("id, user_id, task_text, xp_reward, task_date, scheduled_time, start_notification_sent, reminder_enabled, reminder_sent, reminder_minutes_before, completed")
      .eq("task_date", todayIso)
      .eq("completed", false)
      .not("scheduled_time", "is", null)
      .limit(maxTask);

    if (taskError) throw taskError;

    const taskUserIds = [...new Set((taskCandidates ?? []).map((row) => row.user_id as string))];
    const taskProfiles = taskUserIds.length > 0
      ? (await supabase
        .from("profiles")
        .select("id, task_reminders_enabled")
        .in("id", taskUserIds)).data as Pick<ProfileRow, "id" | "task_reminders_enabled">[] | null
      : [];
    const taskReminderEnabledByUser = new Map((taskProfiles ?? []).map((row) => [row.id, row.task_reminders_enabled !== false]));

    for (const task of taskCandidates ?? []) {
      const scheduledAt = toScheduledDateTime(task.task_date, task.scheduled_time);
      if (!scheduledAt) continue;
      if (scheduledAt > now) continue;

      const remindersEnabled = taskReminderEnabledByUser.get(task.user_id) ?? true;

      if (!task.start_notification_sent && remindersEnabled) {
        inserts.push(rowForQueue({
          userId: task.user_id,
          type: "task_start",
          sourceTable: "daily_tasks",
          sourceId: task.id,
          dedupeKey: `task_start:${task.id}`,
          scheduledFor: scheduledAt.toISOString(),
          payload: {
            task_id: task.id,
            task_text: task.task_text,
            xp_reward: task.xp_reward,
            type: "task_start",
            url: "/tasks",
          },
        }));
      }

      if (task.reminder_enabled && !task.reminder_sent && remindersEnabled) {
        const minutesBefore = typeof task.reminder_minutes_before === "number" ? task.reminder_minutes_before : 15;
        const reminderAt = new Date(scheduledAt.getTime() - minutesBefore * 60_000);
        if (reminderAt <= now) {
          inserts.push(rowForQueue({
            userId: task.user_id,
            type: "task_reminder",
            sourceTable: "daily_tasks",
            sourceId: task.id,
            dedupeKey: `task_reminder:${task.id}:${minutesBefore}`,
            scheduledFor: reminderAt.toISOString(),
            payload: {
              task_id: task.id,
              task_text: task.task_text,
              xp_reward: task.xp_reward,
              reminder_minutes_before: minutesBefore,
              type: "task_reminder",
              url: "/tasks",
            },
          }));
        }
      }
    }

    // 3) Habit reminders
    const { data: habitCandidates, error: habitError } = await supabase
      .from("habits")
      .select("id, user_id, title, preferred_time, reminder_minutes_before, frequency, custom_days, reminder_sent_today")
      .eq("reminder_enabled", true)
      .eq("is_active", true)
      .eq("reminder_sent_today", false)
      .not("preferred_time", "is", null)
      .limit(maxHabit);

    if (habitError) throw habitError;

    const habitUserIds = [...new Set((habitCandidates ?? []).map((row) => row.user_id as string))];
    const habitProfiles = habitUserIds.length > 0
      ? (await supabase
        .from("profiles")
        .select("id, timezone, habit_reminders_enabled")
        .in("id", habitUserIds)).data as Pick<ProfileRow, "id" | "timezone" | "habit_reminders_enabled">[] | null
      : [];
    const habitProfileMap = new Map((habitProfiles ?? []).map((row) => [row.id, row]));

    for (const habit of habitCandidates ?? []) {
      const profile = habitProfileMap.get(habit.user_id);
      if (!profile || profile.habit_reminders_enabled === false) continue;

      const timezone = normalizeTimezone(profile.timezone);
      const local = getLocalDateTimeParts(now, timezone);
      const weekday = getLocalWeekdayIndex(now, timezone);

      const isDueToday = habit.frequency === "daily" ||
        (habit.frequency === "custom" && Array.isArray(habit.custom_days) && habit.custom_days.includes(weekday));
      if (!isDueToday) continue;

      const { data: completion } = await supabase
        .from("habit_completions")
        .select("id")
        .eq("habit_id", habit.id)
        .eq("date", local.localDate)
        .limit(1)
        .maybeSingle();

      if (completion) continue;

      const preferred = String(habit.preferred_time);
      const [hoursRaw, minutesRaw] = preferred.split(":");
      const hours = Number.parseInt(hoursRaw, 10);
      const minutes = Number.parseInt(minutesRaw, 10);
      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) continue;

      const reminderMinutesBefore = typeof habit.reminder_minutes_before === "number" ? habit.reminder_minutes_before : 15;
      const targetMinutes = (hours * 60 + minutes) - reminderMinutesBefore;
      const nowLocalMinutes = local.hour * 60 + local.minute;
      const lateness = nowLocalMinutes - targetMinutes;
      if (lateness < 0 || lateness > 360) continue;

      inserts.push(rowForQueue({
        userId: habit.user_id,
        type: "habit_reminder",
        sourceTable: "habits",
        sourceId: habit.id,
        dedupeKey: `habit_reminder:${habit.id}:${local.localDate}`,
        scheduledFor: nowIso,
        payload: {
          habit_id: habit.id,
          habit_title: habit.title,
          local_date: local.localDate,
          type: "habit_reminder",
          url: "/habits",
        },
      }));
    }

    // 4) Contact reminders
    const { data: dueContacts, error: contactError } = await supabase
      .from("contact_reminders")
      .select(`
        id,
        user_id,
        reason,
        reminder_at,
        contacts:contact_id (
          id,
          name
        )
      `)
      .eq("sent", false)
      .lte("reminder_at", nowIso)
      .limit(maxContact);

    if (contactError) throw contactError;

    for (const reminder of dueContacts ?? []) {
      const contactRaw = reminder.contacts as unknown;
      const contact = contactRaw as { id: string; name: string } | null;
      if (!contact) continue;

      inserts.push(rowForQueue({
        userId: reminder.user_id,
        type: "contact_reminder",
        sourceTable: "contact_reminders",
        sourceId: reminder.id,
        dedupeKey: `contact_reminder:${reminder.id}`,
        scheduledFor: reminder.reminder_at ?? nowIso,
        payload: {
          reminder_id: reminder.id,
          contact_id: contact.id,
          contact_name: contact.name,
          reason: reminder.reason,
          type: "contact_reminder",
          url: "/contacts",
        },
      }));
    }

    // 5) Mentor nudges
    const { data: pendingNudges, error: nudgeError } = await supabase
      .from("mentor_nudges")
      .select("id, user_id, message, nudge_type, context")
      .is("push_sent_at", null)
      .is("dismissed_at", null)
      .order("created_at", { ascending: true })
      .limit(maxNudge);

    if (nudgeError) throw nudgeError;

    const nudges = (pendingNudges ?? []).filter((row) => {
      const context = row.context as { send_push?: boolean } | null;
      return context?.send_push === true;
    });

    const nudgeUserIds = [...new Set(nudges.map((row) => row.user_id as string))];
    const nudgeCompanionMap = nudgeUserIds.length > 0
      ? toCompanionMap((await supabase
        .from("user_companion")
        .select("user_id, cached_creature_name, spirit_animal, current_mood, inactive_days")
        .in("user_id", nudgeUserIds)).data as CompanionRow[] | null)
      : new Map<string, CompanionNotificationContext>();

    for (const nudge of nudges) {
      inserts.push(rowForQueue({
        userId: nudge.user_id,
        type: "mentor_nudge",
        sourceTable: "mentor_nudges",
        sourceId: nudge.id,
        dedupeKey: `mentor_nudge:${nudge.id}`,
        scheduledFor: nowIso,
        payload: {
          nudge_id: nudge.id,
          nudge_type: nudge.nudge_type,
          message: nudge.message,
          context: nudge.context,
          type: "mentor_nudge",
          url: "/companion",
        },
        companion: nudgeCompanionMap.get(nudge.user_id) ?? null,
      }));
    }

    // 6) Check-in reminders
    const { data: checkinProfiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, timezone, checkin_reminders_enabled")
      .eq("checkin_reminders_enabled", true)
      .limit(maxProfiles);

    if (profileError) throw profileError;

    for (const profile of checkinProfiles ?? []) {
      const timezone = normalizeTimezone(profile.timezone);
      const local = getLocalDateTimeParts(now, timezone);
      const nowLocalMinutes = local.hour * 60 + local.minute;

      const morningJitter = await computeDeterministicJitterMinutes(profile.id, local.localDate, "morning", 60);
      const eveningJitter = await computeDeterministicJitterMinutes(profile.id, local.localDate, "evening", 60);

      const morningTarget = Math.max(0, Math.min(23 * 60 + 59, 10 * 60 + morningJitter));
      let eveningTarget = Math.max(0, Math.min(23 * 60 + 59, 20 * 60 + eveningJitter));

      if (eveningTarget - morningTarget < 6 * 60) {
        eveningTarget = Math.min(23 * 60 + 59, morningTarget + 6 * 60);
      }

      const morningDue = nowLocalMinutes >= morningTarget && nowLocalMinutes <= Math.min(16 * 60, morningTarget + 180);
      const eveningDue = nowLocalMinutes >= eveningTarget && nowLocalMinutes <= Math.min(23 * 60 + 30, eveningTarget + 180);

      if (morningDue) {
        const { data: existingMorning } = await supabase
          .from("daily_check_ins")
          .select("id")
          .eq("user_id", profile.id)
          .eq("check_in_type", "morning")
          .eq("check_in_date", local.localDate)
          .maybeSingle();

        if (!existingMorning) {
          inserts.push(rowForQueue({
            userId: profile.id,
            type: "checkin_morning_reminder",
            sourceTable: "profiles",
            sourceId: profile.id,
            dedupeKey: `checkin_morning:${profile.id}:${local.localDate}`,
            scheduledFor: nowIso,
            payload: {
              local_date: local.localDate,
              local_target_minutes: morningTarget,
              timezone,
              type: "checkin_morning_reminder",
              url: "/",
            },
          }));
        }
      }

      if (eveningDue) {
        const { data: existingEvening } = await supabase
          .from("evening_reflections")
          .select("id")
          .eq("user_id", profile.id)
          .eq("reflection_date", local.localDate)
          .maybeSingle();

        if (!existingEvening) {
          inserts.push(rowForQueue({
            userId: profile.id,
            type: "checkin_evening_reminder",
            sourceTable: "profiles",
            sourceId: profile.id,
            dedupeKey: `checkin_evening:${profile.id}:${local.localDate}`,
            scheduledFor: nowIso,
            payload: {
              local_date: local.localDate,
              local_target_minutes: eveningTarget,
              timezone,
              type: "checkin_evening_reminder",
              url: "/reflection",
            },
          }));
        }
      }
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase
        .from("push_notification_queue")
        .upsert(inserts, { onConflict: "dedupe_key", ignoreDuplicates: true });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        queued: inserts.length,
        scanned: {
          daily_pep: duePepPushes?.length ?? 0,
          tasks: taskCandidates?.length ?? 0,
          habits: habitCandidates?.length ?? 0,
          contact_reminders: dueContacts?.length ?? 0,
          mentor_nudges: nudges.length,
          checkin_profiles: checkinProfiles?.length ?? 0,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[notifications-enqueue-v2] fatal:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
