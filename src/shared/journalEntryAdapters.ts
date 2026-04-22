import type { Tables } from "@/integrations/supabase/types";
import type { JournalEntry } from "@/types/domain";

type ReflectionRow = Tables<"user_reflections">;
type EveningReflectionRow = Tables<"evening_reflections">;
type DailyCheckInRow = Tables<"daily_check_ins">;

export const toJournalEntryFromReflection = (
  reflection: ReflectionRow,
): JournalEntry => ({
  id: reflection.id,
  userId: reflection.user_id,
  entryType: "reflection",
  date: reflection.reflection_date,
  mood: reflection.mood,
  body: reflection.note ?? null,
  aiResponse: reflection.ai_reply ?? null,
  wins: null,
  gratitude: null,
  intention: null,
  tomorrowAdjustment: null,
  sourceTable: "user_reflections",
  createdAt: reflection.created_at,
  checkInType: null,
});

export const toJournalEntryFromEveningReflection = (
  reflection: EveningReflectionRow,
): JournalEntry => ({
  id: reflection.id,
  userId: reflection.user_id,
  entryType: "evening_reflection",
  date: reflection.reflection_date,
  mood: reflection.mood,
  body: reflection.additional_reflection ?? null,
  aiResponse: reflection.mentor_response ?? null,
  wins: reflection.wins ?? null,
  gratitude: reflection.gratitude ?? null,
  intention: null,
  tomorrowAdjustment: reflection.tomorrow_adjustment ?? null,
  sourceTable: "evening_reflections",
  createdAt: reflection.created_at,
  checkInType: null,
});

export const toJournalEntryFromDailyCheckIn = (
  checkIn: DailyCheckInRow,
): JournalEntry => ({
  id: checkIn.id,
  userId: checkIn.user_id,
  entryType: "daily_check_in",
  date: checkIn.check_in_date,
  mood: checkIn.mood ?? null,
  body: checkIn.reflection ?? null,
  aiResponse: checkIn.mentor_response ?? null,
  wins: null,
  gratitude: null,
  intention: checkIn.intention ?? null,
  tomorrowAdjustment: null,
  sourceTable: "daily_check_ins",
  createdAt: checkIn.created_at,
  checkInType: checkIn.check_in_type,
});
