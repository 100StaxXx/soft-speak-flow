import type { Json } from "@/integrations/supabase/types";
import type { TaskAttachment } from "@/types/questAttachments";

export interface UserProfileNotificationSettings {
  dailyPushEnabled?: boolean | null;
  dailyPushTime?: string | null;
  dailyPushWindow?: string | null;
  dailyQuotePushEnabled?: boolean | null;
  dailyQuotePushTime?: string | null;
  dailyQuotePushWindow?: string | null;
  habitRemindersEnabled?: boolean | null;
  taskRemindersEnabled?: boolean | null;
  checkInRemindersEnabled?: boolean | null;
}

export interface UserProfile {
  id: string;
  email: string | null;
  timezone: string | null;
  selectedMentorId: string | null;
  notificationSettings: UserProfileNotificationSettings;
  planningPreferences: Record<string, unknown> | null;
  calendarPreferences: Record<string, unknown> | null;
  aiPreferences: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
}

export interface CampaignHabit {
  id: string;
  title: string;
  difficulty: string | null;
  description: string | null;
  frequency: string | null;
  estimatedMinutes: number | null;
  customDays: number[] | null;
  customMonthDays: number[] | null;
  preferredTime: string | null;
  category: string | null;
}

export interface CampaignHabitLink {
  habitId: string;
  habit: CampaignHabit | null;
}

export interface Campaign {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  targetDays: number;
  progressPercentage: number | null;
  themeColor: string | null;
  habitCount: number;
  milestoneCount: number;
  latestJourneyPathUrl: string | null;
  latestJourneyPathGeneratedAt: string | null;
  latestJourneyPathMilestoneIndex: number | null;
  createdAt: string | null;
  completedAt: string | null;
  xpReward: number | null;
  isPublic: boolean | null;
  inviteCode: string | null;
  storyTypeSlug: string | null;
  rituals: CampaignHabitLink[];
}

export interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string | null;
  targetDays: number;
  progressPercentage: number | null;
  themeColor: string | null;
  habitCount: number;
  milestoneCount: number;
  latestJourneyPathUrl: string | null;
}

export interface Subtask {
  id: string;
  questId: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
  sortOrder: number | null;
  createdAt: string | null;
}

export interface Quest {
  id: string;
  userId: string;
  title: string;
  taskDate: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  completed: boolean;
  completedAt: string | null;
  priority: string | null;
  difficulty: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  habitSourceId: string | null;
  isMainQuest: boolean;
  isRecurring: boolean;
  reminderEnabled: boolean;
  reminderMinutesBefore: number | null;
  aiGenerated: boolean;
  notes: string | null;
  location: string | null;
  source: string | null;
  category: string | null;
  imageUrl: string | null;
  contactId: string | null;
  autoLogInteraction: boolean;
  sortOrder: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  recurrenceMonthDays: number[];
  recurrenceCustomPeriod: "week" | "month" | null;
  recurrenceEndDate: string | null;
  subtasks: Subtask[];
  attachments: TaskAttachment[];
}

export type JournalEntryType =
  | "reflection"
  | "evening_reflection"
  | "daily_check_in";

export interface JournalEntry {
  id: string;
  userId: string;
  entryType: JournalEntryType;
  date: string;
  mood: string | null;
  body: string | null;
  aiResponse: string | null;
  wins: string | null;
  gratitude: string | null;
  intention: string | null;
  tomorrowAdjustment: string | null;
  sourceTable: "user_reflections" | "evening_reflections" | "daily_check_ins";
  createdAt: string | null;
  checkInType: string | null;
}

export type CalendarItemSource = "external_event" | "quest";

export interface CalendarItem {
  id: string;
  source: CalendarItemSource;
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  provider: string | null;
  readOnly: boolean;
  questId: string | null;
  syncMode: string | null;
  sourceTable: "external_calendar_events" | "daily_tasks";
  externalEventId: string | null;
  connectionId: string | null;
  taskDate: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
}

export type AiActivityType =
  | "interaction"
  | "validation"
  | "chat_message"
  | "chat_thread"
  | "pending_action";

export interface AiActivity {
  id: string;
  activityType: AiActivityType;
  createdAt: string | null;
  surface: string | null;
  sessionId: string | null;
  intent: string | null;
  status: string | null;
  summary: string;
  sourceTable:
    | "ai_interactions"
    | "ai_output_validation_log"
    | "companion_chats"
    | "companion_chat_threads"
    | "companion_pending_actions";
  threadId: string | null;
  role: string | null;
  metadata: Json | null;
}
