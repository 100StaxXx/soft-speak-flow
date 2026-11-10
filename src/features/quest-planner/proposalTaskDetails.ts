import { validateQuestDetails, type PlannedQuest } from '../../../supabase/functions/cosmiq-quest-planner/planning';
import { getPrimaryQuestReminderOffset } from '@/utils/questReminders';
/** Keep structured details identical from reviewed proposal through Agenda/offline persistence. */
export function proposalTaskDetails(quest: PlannedQuest) {
  validateQuestDetails(quest);
  const offsets=quest.reminder_offsets_minutes;
  return {
    add: {
      ...(quest.recurrence?{recurrencePattern:quest.recurrence.pattern,recurrenceDays:quest.recurrence.days,recurrenceMonthDays:quest.recurrence.month_days,recurrenceEndDate:quest.recurrence.end_date}:{}),
      notes: quest.notes ?? `Goal: ${quest.goal}`,
      location: quest.location ?? null,
      ...(quest.time_fixed ? {keepTimeFixed:true} : {}),
      ...(offsets != null ? {reminderEnabled:offsets.length>0,reminderOffsetsMinutes:offsets,reminderMinutesBefore:getPrimaryQuestReminderOffset(offsets)} : {}),
    },
    update: {
      ...(quest.location != null ? {location:quest.location} : {}),
      ...(quest.notes != null ? {notes:quest.notes} : {}),
      ...(quest.time_fixed ? {flexibility:'fixed' as const} : {}),
      ...(offsets != null ? {reminder_enabled:offsets.length>0,reminder_offsets_minutes:offsets,reminder_minutes_before:getPrimaryQuestReminderOffset(offsets)} : {}),
    },
  };
}
