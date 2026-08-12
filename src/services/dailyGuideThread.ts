import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { safeLocalStorage } from "@/utils/storage";

export type DailyGuideThreadRow = Database["public"]["Tables"]["daily_guide_threads"]["Row"];
export type DailyGuideThreadPatch = Omit<
  Database["public"]["Tables"]["daily_guide_threads"]["Update"],
  "id" | "user_id" | "thread_date" | "created_at" | "updated_at"
>;

const log = logger.scope("DailyGuideThread");
const STORAGE_VERSION = 1;
const STORAGE_PREFIX = `graceward:daily-guide-thread:v${STORAGE_VERSION}`;
const INDEX_PREFIX = `${STORAGE_PREFIX}:index`;

const storageKey = (userId: string, date: string) => `${STORAGE_PREFIX}:${userId}:${date}`;
const indexKey = (userId: string) => `${INDEX_PREFIX}:${userId}`;

const isThreadRow = (value: unknown): value is DailyGuideThreadRow => (
  typeof value === "object"
  && value !== null
  && !Array.isArray(value)
  && typeof (value as { user_id?: unknown }).user_id === "string"
  && typeof (value as { thread_date?: unknown }).thread_date === "string"
);

const readLocalThread = (userId: string, date: string): DailyGuideThreadRow | null => {
  const stored = safeLocalStorage.getItem(storageKey(userId, date));
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as unknown;
    return isThreadRow(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readLocalIndex = (userId: string): string[] => {
  const stored = safeLocalStorage.getItem(indexKey(userId));
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(0, 14)
      : [];
  } catch {
    return [];
  }
};

const writeLocalThread = (thread: DailyGuideThreadRow): DailyGuideThreadRow => {
  safeLocalStorage.setItem(storageKey(thread.user_id, thread.thread_date), JSON.stringify(thread));
  const dates = [
    thread.thread_date,
    ...readLocalIndex(thread.user_id).filter((date) => date !== thread.thread_date),
  ].sort((left, right) => right.localeCompare(left)).slice(0, 14);
  safeLocalStorage.setItem(indexKey(thread.user_id), JSON.stringify(dates));
  return thread;
};

const buildLocalThread = (
  userId: string,
  date: string,
  patch: DailyGuideThreadPatch,
): DailyGuideThreadRow => {
  const existing = readLocalThread(userId, date);
  const now = new Date().toISOString();
  return {
    id: existing?.id ?? `local:${userId}:${date}`,
    user_id: userId,
    thread_date: date,
    mentor_id: null,
    mentor_name: null,
    daily_pep_talk_id: null,
    encouragement_title: null,
    encouragement_completed_at: null,
    guide_question_id: null,
    guide_question: null,
    focus_option_id: null,
    focus_label: null,
    focus_category: null,
    focus_answered_at: null,
    companion_question_id: null,
    companion_question: null,
    companion_answer_id: null,
    companion_answer_label: null,
    companion_answered_at: null,
    companion_response: null,
    companion_acknowledged_at: null,
    practice_assignment_id: null,
    practice_key: null,
    practice_completed_at: null,
    evening_reflection_id: null,
    evening_reflected_at: null,
    created_at: existing?.created_at ?? now,
    ...existing,
    ...patch,
    updated_at: now,
  };
};

export async function fetchDailyGuideThread(
  userId: string,
  date: string,
): Promise<DailyGuideThreadRow | null> {
  try {
    const { data, error } = await supabase
      .from("daily_guide_threads")
      .select("*")
      .eq("user_id", userId)
      .eq("thread_date", date)
      .maybeSingle();

    if (!error) {
      return data ? writeLocalThread(data) : readLocalThread(userId, date);
    }

    log.warn("Using local daily-thread memory until sync returns", { error: error.message, date });
  } catch (error) {
    log.warn("Using local daily-thread memory after a network error", {
      error: error instanceof Error ? error.message : String(error),
      date,
    });
  }
  return readLocalThread(userId, date);
}

export async function fetchPreviousDailyGuideThread(
  userId: string,
  beforeDate: string,
): Promise<DailyGuideThreadRow | null> {
  try {
    const { data, error } = await supabase
      .from("daily_guide_threads")
      .select("*")
      .eq("user_id", userId)
      .lt("thread_date", beforeDate)
      .order("thread_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      return data ? writeLocalThread(data) : null;
    }
  } catch (error) {
    log.warn("Reading the previous daily thread from local memory", {
      error: error instanceof Error ? error.message : String(error),
      beforeDate,
    });
  }

  const previousDate = readLocalIndex(userId).find((date) => date < beforeDate);
  return previousDate ? readLocalThread(userId, previousDate) : null;
}

export async function updateDailyGuideThread(
  userId: string,
  date: string,
  patch: DailyGuideThreadPatch,
): Promise<DailyGuideThreadRow> {
  const localThread = writeLocalThread(buildLocalThread(userId, date, patch));
  const {
    id: _localId,
    user_id: _localUserId,
    thread_date: _localThreadDate,
    created_at: _localCreatedAt,
    updated_at: _localUpdatedAt,
    ...syncedThread
  } = localThread;
  try {
    const { data, error } = await supabase
      .from("daily_guide_threads")
      .upsert({
        user_id: userId,
        thread_date: date,
        ...syncedThread,
      }, {
        onConflict: "user_id,thread_date",
      })
      .select("*")
      .single();

    if (error || !data) {
      log.warn("Daily-thread update is queued in local memory", {
        error: error?.message ?? "No row returned",
        date,
      });
      return localThread;
    }

    return writeLocalThread(data);
  } catch (error) {
    log.warn("Daily-thread update is queued after a network error", {
      error: error instanceof Error ? error.message : String(error),
      date,
    });
    return localThread;
  }
}
