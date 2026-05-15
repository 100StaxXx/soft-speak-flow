import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback, memo, type CSSProperties, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTimelineDrag } from "@/hooks/useTimelineDrag";
import { addDays, format, isSameDay } from "date-fns";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from "@/components/ui/sonner";
import {
  Flame,
  Trophy,
  Check,
  Circle,
  Clock,
  Pencil,
  Repeat,
  ChevronDown,
  Target,
  FileText,
  FileImage,
  Paperclip,
  Timer,
  Brain,
  Heart,
  Dumbbell,
  ArrowUpDown,
  MoreHorizontal,
  CalendarPlus,
  CalendarDays,
  CalendarArrowUp,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  Plus,
  Inbox,
} from "lucide-react";
import { JourneysCompanionLauncher } from "@/components/journeys/JourneysCompanionLauncher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { DragTimeZoomRail } from "@/components/calendar/DragTimeZoomRail";
import { CalendarTask } from "@/types/quest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { QuestLocationLink } from "@/components/QuestLocationLink";
import { cn, formatDisplayLabel, stripMarkdown } from "@/lib/utils";
import {
  COMPANION_FROSTED_PLANNER_DARK_CLASS,
  COMPANION_FROSTED_THEME_SCOPE_CLASS,
} from "@/lib/companionFrostedTheme";
import { supabase } from "@/integrations/supabase/client";
import { MAIN_QUEST_XP_MULTIPLIER } from "@/config/xpRewards";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { playStrikethrough } from "@/utils/soundEffects";
import { loadLocalHabits } from "@/utils/plannerSync";

import { type DragHandleProps as ListDragHandleProps } from "./DraggableTaskList";
import { MarqueeText } from "@/components/ui/marquee-text";
import { JourneyPathDrawer } from "@/components/JourneyPathDrawer";
import { TimelineTaskRow } from "@/components/TimelineTaskRow";
import { ProgressRing } from "@/features/tasks/components/ProgressRing";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import type { JourneysLayoutMode } from "@/hooks/useJourneysLayoutMode";
import { buildTaskConflictMap, getTaskConflictSetForTask } from "@/utils/taskTimeConflicts";
import { buildTaskTimelineFlow } from "@/utils/taskTimelineFlow";
import {
  SHARED_TIMELINE_DRAG_INTERACTION_PROFILE,
  SHARED_TIMELINE_DRAG_PROFILE,
} from "@/components/calendar/dragSnap";
import type { TaskAttachment } from "@/types/questAttachments";
import { getEpicDaysRemaining, resolveEpicEndDate } from "@/utils/epicDates";
import {
  CAMPAIGN_RITUAL_CARD_CLASS_NAME,
  CAMPAIGN_RITUAL_CARD_CLASSES,
  isCampaignRitualTask,
} from "@/utils/campaignRitualStyle";
import {
  DesktopQuestDetailsPopover,
} from "@/components/DesktopQuestDetailsPopover";
import { QUEST_LAUNCHER_SCROLL_CLEARANCE_PX } from "@/components/quest-launchers/metrics";
import { createCompanionPlannerQuestCaptureLaunchIntent } from "@/shared/companionPlannerSurfaceActions";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";
import { createPlanDayCompanionLaunchIntent } from "@/utils/companionPlannerLaunchContext";
import type { Habit } from "@/features/habits/types";
import { durationMinutesToPixels } from "@/utils/taskDurationLayout";

// Helper to calculate days remaining
const getDaysLeft = (epic: { start_date: string; target_days: number; end_date?: string | null }) =>
  getEpicDaysRemaining({
    start_date: epic.start_date,
    target_days: epic.target_days,
    end_date: epic.end_date,
  });

const safeFormat = (date: Date, fmt: string, fallback = "") => {
  try {
    if (Number.isNaN(date.getTime())) return fallback;
    return format(date, fmt);
  } catch {
    return fallback;
  }
};

const TOUCH_CLICK_SUPPRESSION_RESET_MS = 750;
const JOURNEYS_QUEST_CARD_SHELL_CLASS_NAME =
  `${COMPANION_FROSTED_THEME_SCOPE_CLASS} journeys-quest-card-shell overflow-hidden border transition-colors`;
const JOURNEYS_QUEST_CARD_SHELL_STANDARD_TONE_CLASS_NAME =
  "border-white/10 bg-white/[0.04] shadow-[0_12px_22px_rgba(0,0,0,0.14)]";
const JOURNEYS_QUEST_CARD_SHELL_ACTIVE_CLASS_NAME = "journeys-quest-card-shell--active";
const JOURNEYS_QUEST_CARD_SHELL_READABLE_CLASS_NAME = "journeys-quest-card-shell--readable";

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  task_date?: string;
  scheduled_time?: string | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  sort_order?: number | null;
  // Expandable detail fields
  notes?: string | null;
  priority?: string | null;
  estimated_duration?: number | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  image_url?: string | null;
  location?: string | null;
  attachments?: TaskAttachment[] | null;
  subtasks?: TaskSubtask[];
}

interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean | null;
  sort_order: number | null;
}

interface DisplayAttachment {
  fileUrl: string;
  fileName: string;
  isImage: boolean;
}

const FALLBACK_ATTACHMENT_NAME = "Photo attachment";
type HabitWithDescription = Habit & { description?: string | null };

const normalizeDetailText = (text: string | null | undefined): string =>
  stripMarkdown(text).replace(/\s+/g, " ").trim();

const normalizeDisplayAttachments = (task: Task): DisplayAttachment[] => {
  const normalized = (task.attachments ?? [])
    .filter((attachment) => typeof attachment.fileUrl === "string" && attachment.fileUrl.trim().length > 0)
    .map((attachment) => ({
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName?.trim() || FALLBACK_ATTACHMENT_NAME,
      isImage: !!attachment.isImage,
    }));

  if (normalized.length > 0) return normalized;

  if (task.image_url) {
    return [
      {
        fileUrl: task.image_url,
        fileName: FALLBACK_ATTACHMENT_NAME,
        isImage: true,
      },
    ];
  }

  return [];
};

const patchSubtaskCompletionInTaskList = <T extends { id: string; subtasks?: TaskSubtask[] }>(
  tasks: T[] | undefined,
  taskId: string,
  subtaskId: string,
  completed: boolean
): T[] | undefined => {
  if (!tasks) return tasks;

  return tasks.map((task) => {
    if (task.id !== taskId || !task.subtasks) return task;
    return {
      ...task,
      subtasks: task.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed } : subtask
      ),
    };
  });
};

interface TodaysAgendaProps {
  tasks: Task[];
  selectedDate: Date;
  readableQuestCardsEnabled?: boolean;
  layoutMode?: JourneysLayoutMode;
  hideDesktopRailAddButton?: boolean;
  isVisible?: boolean;
  disableTimelineDrag?: boolean;
  desktopPlannerMode?: "week" | "day";
  desktopInteractionResetKey?: string | number;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onAddQuest: () => void;
  onOpenCompanionPlanner?: (intent?: CompanionPlannerLaunchIntent | null) => void;
  onVoiceAddQuest?: () => void;
  isVoiceAddRecording?: boolean;
  isVoiceAddSupported?: boolean;
  showCompanionPlannerHeaderAction?: boolean;
  completedCount: number;
  totalCount: number;
  currentStreak?: number;
  onUndoToggle?: (taskId: string, xpReward: number) => void;
  onEditQuest?: (task: Task) => void;
  weekTasks?: CalendarTask[];
  activeEpics?: Array<{
    id: string;
    title: string;
    description?: string | null;
    progress_percentage?: number | null;
    target_days: number;
    start_date: string;
    end_date: string | null;
    epic_habits?: Array<{
      habit_id: string;
      habits: {
        id: string;
        title: string;
        difficulty: string;
        description?: string | null;
        frequency?: string;
        estimated_minutes?: number | null;
        custom_days?: number[] | null;
      };
    }>;
  }>;
  isCampaignsLoading?: boolean;
  onOpenCampaigns?: () => void;
  onDeleteQuest?: (taskId: string) => void;
  onMoveQuestToNextDay?: (taskId: string) => void;
  onUpdateScheduledTime?: (taskId: string, newTime: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onDateSelect?: (date: Date) => void;
  onDesktopPlannerModeChange?: (mode: "week" | "day") => void;
  onSendToCalendar?: (taskId: string) => void;
  hasCalendarLink?: (taskId: string) => boolean;
  onOpenMonthView?: () => void;
  timedTaskDurationFallbackMinutes?: number;
  useMacDurationSizedDesktopTimelineRows?: boolean;
  centerNowRequestKey?: string | number;
  companionFrostedThemeStyle?: CSSProperties;
}

type ActiveEpic = NonNullable<TodaysAgendaProps["activeEpics"]>[number];

interface TimelineTaskRenderContext {
  isScheduledTimeline?: boolean;
  heightPx?: number;
  isCompact?: boolean;
}

// Helper to format time in 12-hour format
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const COMBO_WINDOW_MS = 8000;
const DESKTOP_LAYOUT_MIN_WIDTH = 1280;
const LANE_OFFSET_STEP_PX = 10;
const FULL_DAY_START_MINUTE = 0;
const FULL_DAY_END_MINUTE = 24 * 60;
const FULL_DAY_SLOT_INTERVAL_MINUTES = 30;
const OUTLOOK_TIMELINE_HOUR_HEIGHT_PX = 104;
const OUTLOOK_TIMELINE_PX_PER_MINUTE = OUTLOOK_TIMELINE_HOUR_HEIGHT_PX / 60;
const OUTLOOK_TIMELINE_SLOT_HEIGHT_PX = OUTLOOK_TIMELINE_PX_PER_MINUTE * FULL_DAY_SLOT_INTERVAL_MINUTES;
const OUTLOOK_TIMELINE_HEIGHT_PX = FULL_DAY_END_MINUTE * OUTLOOK_TIMELINE_PX_PER_MINUTE;
const OUTLOOK_TIMELINE_GUTTER_WIDTH_PX = 52;
const OUTLOOK_TIMELINE_EVENT_GAP_PX = 4;
const OUTLOOK_TIMELINE_MIN_EVENT_HEIGHT_PX = 52;
const COMPACT_TIMELINE_ROW_MAX_HEIGHT_PX = OUTLOOK_TIMELINE_MIN_EVENT_HEIGHT_PX;
const NOW_MARKER_VIEWPORT_TARGET = 0.45;
const DEFAULT_BOTTOM_NAV_SAFE_OFFSET_PX = 104;
const MOBILE_FAB_SCROLL_CLEARANCE_PX = QUEST_LAUNCHER_SCROLL_CLEARANCE_PX;
const DRAG_OVERLAY_TOP_PADDING_PX = 8;
const DRAG_OVERLAY_BOTTOM_PADDING_PX = 10;
const DRAG_OVERLAY_NAV_GAP_PX = 4;
const DESKTOP_TIMELINE_DURATION_BASE_MINUTES = 30;
const DESKTOP_TIMELINE_DURATION_BASE_HEIGHT_PX = 60;
const EDGE_HOLD_ACTIVATION_MS = 180;
const EDGE_HOLD_PIN_THRESHOLD_PX = 0.5;
const EDGE_HOLD_TOP_NEUTRAL_OVERSHOOT_PX = 24;
const EDGE_HOLD_NEAR_MAX_OVERSHOOT_PX = 24;
const EDGE_HOLD_MEDIUM_MAX_OVERSHOOT_PX = 72;
const EDGE_HOLD_HIGH_MAX_OVERSHOOT_PX = 140;
const EDGE_HOLD_NEAR_REPEAT_MS = 180;
const EDGE_HOLD_MEDIUM_REPEAT_MS = 140;
const EDGE_HOLD_HIGH_REPEAT_MS = 100;
const EDGE_HOLD_EXTREME_REPEAT_MS = 75;
const EDGE_HOLD_NEAR_STEP_MULTIPLIER = 1;
const EDGE_HOLD_MEDIUM_STEP_MULTIPLIER = 1;
const EDGE_HOLD_HIGH_STEP_MULTIPLIER = 2;
const EDGE_HOLD_EXTREME_STEP_MULTIPLIER = 3;
const TIME_SLOT_LONG_PRESS_MS = 600;
const TIME_SLOT_LONG_PRESS_MOVE_SLOP_PX = 10;

interface TimeSlotLongPressState {
  timerId: number;
  startX: number;
  startY: number;
}

interface EdgeHoldProfile {
  repeatMs: number;
  stepMultiplier: number;
}

const resolveEdgeHoldProfile = (overshootPx: number): EdgeHoldProfile | null => {
  if (!Number.isFinite(overshootPx) || overshootPx <= EDGE_HOLD_PIN_THRESHOLD_PX) {
    return null;
  }
  if (overshootPx <= EDGE_HOLD_NEAR_MAX_OVERSHOOT_PX) {
    return {
      repeatMs: EDGE_HOLD_NEAR_REPEAT_MS,
      stepMultiplier: EDGE_HOLD_NEAR_STEP_MULTIPLIER,
    };
  }
  if (overshootPx <= EDGE_HOLD_MEDIUM_MAX_OVERSHOOT_PX) {
    return {
      repeatMs: EDGE_HOLD_MEDIUM_REPEAT_MS,
      stepMultiplier: EDGE_HOLD_MEDIUM_STEP_MULTIPLIER,
    };
  }
  if (overshootPx <= EDGE_HOLD_HIGH_MAX_OVERSHOOT_PX) {
    return {
      repeatMs: EDGE_HOLD_HIGH_REPEAT_MS,
      stepMultiplier: EDGE_HOLD_HIGH_STEP_MULTIPLIER,
    };
  }
  return {
    repeatMs: EDGE_HOLD_EXTREME_REPEAT_MS,
    stepMultiplier: EDGE_HOLD_EXTREME_STEP_MULTIPLIER,
  };
};

interface DragOverlaySnapshot {
  taskId: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

const parsePixelValue = (value: string | null | undefined): number | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.endsWith("px")) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const getBottomNavObstructionPx = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_BOTTOM_NAV_SAFE_OFFSET_PX;
  }

  const rootStyles = window.getComputedStyle(document.documentElement);
  const runtimeOffset = parsePixelValue(rootStyles.getPropertyValue("--bottom-nav-runtime-offset"));
  if (runtimeOffset !== null) {
    return runtimeOffset;
  }

  const safeOffset = parsePixelValue(rootStyles.getPropertyValue("--bottom-nav-safe-offset"));
  if (safeOffset !== null) {
    return safeOffset;
  }

  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.top = "0";
  probe.style.left = "0";
  probe.style.height = "var(--bottom-nav-runtime-offset, var(--bottom-nav-safe-offset))";
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();

  if (Number.isFinite(measured) && measured > 0) {
    return measured;
  }

  const rootFontSize = Number.parseFloat(
    window.getComputedStyle(document.documentElement).fontSize || "16",
  );
  const safeFontSize = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
  return safeFontSize * 6.5;
};

const parseTimeToMinute = (time: string | null | undefined): number | null => {
  if (!time) return null;
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return (hour * 60) + minute;
};

const minuteToTime = (minute: number) => {
  const clamped = Math.max(0, Math.min((24 * 60) - 1, Math.round(minute)));
  const hour = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const minuteToMarkerToken = (minute: number) => minuteToTime(minute).replace(":", "");

const formatGridTimeLabel = (minute: number) => {
  const clamped = Math.max(FULL_DAY_START_MINUTE, Math.min(FULL_DAY_END_MINUTE - 1, Math.round(minute)));
  const hour = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return format(new Date(2000, 0, 1, hour, mins), mins === 0 ? "h a" : "h:mm a");
};

const formatCurrentTimeLabel = (minute: number) => {
  const clamped = Math.max(FULL_DAY_START_MINUTE, Math.min(FULL_DAY_END_MINUTE - 1, Math.round(minute)));
  const hour = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return format(new Date(2000, 0, 1, hour, mins), "h:mm a");
};

const buildFullDaySlotMinutes = () => {
  const slots: number[] = [];
  for (let minute = FULL_DAY_START_MINUTE; minute < FULL_DAY_END_MINUTE; minute += FULL_DAY_SLOT_INTERVAL_MINUTES) {
    slots.push(minute);
  }
  return slots;
};

const getTimelineTopPx = (minute: number) => (
  Math.max(FULL_DAY_START_MINUTE, Math.min(FULL_DAY_END_MINUTE, minute)) * OUTLOOK_TIMELINE_PX_PER_MINUTE
);

const isTimeSlotInteractiveTarget = (target: EventTarget | null): boolean => {
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest([
    "button",
    "a",
    "input",
    "textarea",
    "select",
    '[role="button"]',
    '[data-interactive="true"]',
    '[data-tap-control="true"]',
    '[contenteditable="true"]',
  ].join(",")));
};

const getLaneOffsetPx = (laneIndex: number, overlapCount: number) => {
  return overlapCount > 0 ? laneIndex * LANE_OFFSET_STEP_PX : 0;
};

export const TodaysAgenda = memo(function TodaysAgenda({
  tasks,
  selectedDate,
  readableQuestCardsEnabled = false,
  layoutMode,
  hideDesktopRailAddButton = false,
  isVisible = true,
  disableTimelineDrag = false,
  desktopPlannerMode = "day",
  desktopInteractionResetKey,
  timedTaskDurationFallbackMinutes = 30,
  useMacDurationSizedDesktopTimelineRows = false,
  onToggle,
  onAddQuest,
  onOpenCompanionPlanner,
  onVoiceAddQuest,
  isVoiceAddRecording = false,
  isVoiceAddSupported = true,
  showCompanionPlannerHeaderAction = false,
  completedCount,
  totalCount,
  currentStreak = 0,
  onUndoToggle,
  onEditQuest,
  weekTasks = [],
  activeEpics = [],
  isCampaignsLoading = false,
  onOpenCampaigns,
  onDeleteQuest,
  onMoveQuestToNextDay,
  onUpdateScheduledTime,
  onTimeSlotLongPress,
  onDateSelect,
  onDesktopPlannerModeChange,
  onSendToCalendar,
  hasCalendarLink,
  onOpenMonthView,
  centerNowRequestKey,
  companionFrostedThemeStyle,
}: TodaysAgendaProps) {
  const { user } = useAuth();
  const questCaptureDateLabel = isSameDay(selectedDate, new Date())
    ? "today"
    : safeFormat(selectedDate, "EEEE, MMMM d", "that day");
  const questCaptureSelectedDate = safeFormat(selectedDate, "yyyy-MM-dd");
  const planDayLauncherLabel = isSameDay(selectedDate, new Date()) ? "Plan Today" : "Plan Day";
  const openPlanDayThread = useCallback(() => {
    if (!onOpenCompanionPlanner) return;
    onOpenCompanionPlanner(createPlanDayCompanionLaunchIntent({
      selectedDate,
      tasks,
      activeEpics,
      assumeTasksAreForSelectedDate: true,
    }));
  }, [activeEpics, onOpenCompanionPlanner, selectedDate, tasks]);
  const plannerLauncherAction = onOpenCompanionPlanner ? openPlanDayThread : onVoiceAddQuest ?? onAddQuest;
  const openQuestCaptureThread = useCallback(() => {
    if (onOpenCompanionPlanner) {
      onOpenCompanionPlanner(createCompanionPlannerQuestCaptureLaunchIntent({
        source: "empty_journeys",
        dateLabel: questCaptureDateLabel,
        selectedDate: questCaptureSelectedDate,
      }));
      return;
    }
    if (onVoiceAddQuest) {
      onVoiceAddQuest();
      return;
    }
    onAddQuest();
  }, [onAddQuest, onOpenCompanionPlanner, onVoiceAddQuest, questCaptureDateLabel, questCaptureSelectedDate]);
  const voiceAddButtonLabel = isVoiceAddRecording ? "Stop voice capture" : "Start voice capture";
  const quickCaptureControls = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 rounded-[18px] border-white/10 bg-white/5 hover:bg-white/10"
        onClick={onAddQuest}
        aria-label="Add quest"
        data-tour="add-quest-fab"
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant={isVoiceAddRecording ? "secondary" : "outline"}
        size="icon"
        className={cn(
          "h-9 w-9 rounded-[18px] border-white/10 bg-white/5 hover:bg-white/10",
          isVoiceAddRecording && "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20",
        )}
        onClick={onVoiceAddQuest}
        aria-label={voiceAddButtonLabel}
        disabled={!onVoiceAddQuest || !isVoiceAddSupported}
        data-testid="journeys-voice-add-button"
      >
        {isVoiceAddRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>
    </div>
  );
  const prefersReducedMotion = useReducedMotion();
  const { capabilities } = useMotionProfile();
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
    if (layoutMode) return layoutMode === "desktop";
    if (typeof window === "undefined") return false;
    return window.innerWidth >= DESKTOP_LAYOUT_MIN_WIDTH;
  });
  const isNativeIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    const capacitor = (window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "ios");
  }, []);
  const useLiteAnimations = isNativeIOS || Boolean(prefersReducedMotion) || !capabilities.allowBackgroundAnimation;
  const isTimelineDragEnabled = !disableTimelineDrag;
  const isDesktopTimelineDragEnabled = isTimelineDragEnabled && !isDesktopLayout;
  const mobileFabScrollClearance = isDesktopLayout ? undefined : `${MOBILE_FAB_SCROLL_CLEARANCE_PX}px`;
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const habitsQuery = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      return loadLocalHabits(user.id) as Promise<HabitWithDescription[]>;
    },
    enabled: !!user?.id,
  });
  const keepInPlace = profile?.completed_tasks_stay_in_place ?? true;
  const habitDescriptionByIdFromHabits = useMemo(() => {
    const descriptions = new Map<string, string>();
    for (const habit of habitsQuery.data ?? []) {
      const description = habit.description?.trim();
      if (description) {
        descriptions.set(habit.id, description);
      }
    }
    return descriptions;
  }, [habitsQuery.data]);
  const habitDescriptionById = useMemo(() => {
    const descriptions = new Map<string, string>();

    for (const epic of activeEpics) {
      for (const link of epic.epic_habits ?? []) {
        const description = link.habits?.description?.trim();
        if (description) {
          descriptions.set(link.habit_id, description);
        }
      }
    }

    habitDescriptionByIdFromHabits.forEach((description, habitId) => {
      descriptions.set(habitId, description);
    });

    return descriptions;
  }, [activeEpics, habitDescriptionByIdFromHabits]);

  const toggleSubtask = useMutation({
    mutationFn: async ({
      taskId,
      subtaskId,
      completed,
    }: {
      taskId: string;
      subtaskId: string;
      completed: boolean;
    }) => {
      const { error } = await supabase
        .from("subtasks")
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", subtaskId)
        .eq("task_id", taskId);

      if (error) throw error;
    },
    onMutate: async ({ taskId, subtaskId, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["daily-tasks"] });
      const previousDailyTasks = queryClient.getQueriesData<Task[]>({
        queryKey: ["daily-tasks"],
      });

      queryClient.setQueriesData<Task[]>(
        { queryKey: ["daily-tasks"] },
        (currentTasks) => patchSubtaskCompletionInTaskList(currentTasks, taskId, subtaskId, completed)
      );

      return { previousDailyTasks };
    },
    onError: (_error, _variables, context) => {
      if (!context?.previousDailyTasks) return;
      context.previousDailyTasks.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
    },
  });

  // Timeline drag-to-reschedule
  const timelineDragContainerRef = useRef<HTMLDivElement>(null);
  const scheduledPaneRef = useRef<HTMLDivElement | null>(null);
  const [timelineBodyHeightPx, setTimelineBodyHeightPx] = useState<number | null>(null);
  const setScheduledPaneNode = useCallback((node: HTMLDivElement | null) => {
    scheduledPaneRef.current = node;
    timelineDragContainerRef.current = node;
  }, []);

  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [openDesktopDetailTaskId, setOpenDesktopDetailTaskId] = useState<string | null>(null);
  const [openActionMenuTaskId, setOpenActionMenuTaskId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'custom' | 'time' | 'priority' | 'xp'>('custom');
  const [untimedDrawerOpen, setUntimedDrawerOpen] = useState(false);
  const [justCompletedTasks, setJustCompletedTasks] = useState<Set<string>>(new Set());
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  const [comboCount, setComboCount] = useState(0);
  const [showComboFx, setShowComboFx] = useState(false);
  const lastComboAtRef = useRef<number | null>(null);
  const comboResetTimerRef = useRef<number | null>(null);
  const comboFxTimerRef = useRef<number | null>(null);

  // Track touch start position to distinguish taps from scrolls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextCheckboxClickRef = useRef(false);
  const suppressNextCheckboxClickTimeoutRef = useRef<number | null>(null);
  const desktopTaskClickTimersRef = useRef<Map<string, number>>(new Map());
  const timeSlotLongPressRef = useRef<TimeSlotLongPressState | null>(null);
  const nowMarkerMinuteRef = useRef(0);

  const clearDesktopTaskClickIntent = useCallback((taskId?: string) => {
    if (taskId) {
      const timeoutId = desktopTaskClickTimersRef.current.get(taskId);
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        desktopTaskClickTimersRef.current.delete(taskId);
      }
      return;
    }

    desktopTaskClickTimersRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    desktopTaskClickTimersRef.current.clear();
  }, []);

  useEffect(() => clearDesktopTaskClickIntent, [clearDesktopTaskClickIntent]);

  const scheduleDesktopTaskSingleClick = useCallback((task: Task) => {
    clearDesktopTaskClickIntent(task.id);
    const timeoutId = window.setTimeout(() => {
      setOpenDesktopDetailTaskId(task.id);
      desktopTaskClickTimersRef.current.delete(task.id);
    }, 200);
    desktopTaskClickTimersRef.current.set(task.id, timeoutId);
  }, [clearDesktopTaskClickIntent]);

  const handleDesktopTaskDoubleClick = useCallback((task: Task) => {
    clearDesktopTaskClickIntent(task.id);
    setOpenDesktopDetailTaskId(null);
    onEditQuest?.(task);
  }, [clearDesktopTaskClickIntent, onEditQuest]);

  // Clean up optimistic state when server confirms completion
  useEffect(() => {
    if (layoutMode) {
      setIsDesktopLayout(layoutMode === "desktop");
      return;
    }

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_LAYOUT_MIN_WIDTH}px)`);
    const handleDesktopLayoutChange = () => {
      setIsDesktopLayout(window.innerWidth >= DESKTOP_LAYOUT_MIN_WIDTH);
    };

    handleDesktopLayoutChange();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleDesktopLayoutChange);
      return () => {
        mediaQuery.removeEventListener("change", handleDesktopLayoutChange);
      };
    }

    mediaQuery.addListener(handleDesktopLayoutChange);
    return () => {
      mediaQuery.removeListener(handleDesktopLayoutChange);
    };
  }, [layoutMode]);

  useEffect(() => {
    setOpenDesktopDetailTaskId(null);
  }, [desktopInteractionResetKey]);

  useEffect(() => {
    if (openDesktopDetailTaskId && !tasks.some((task) => task.id === openDesktopDetailTaskId)) {
      setOpenDesktopDetailTaskId(null);
    }
  }, [openDesktopDetailTaskId, tasks]);

  useEffect(() => {
    setOptimisticCompleted(prev => {
      const confirmedIds = tasks.filter(t => t.completed).map(t => t.id);
      const next = new Set(prev);
      confirmedIds.forEach(id => next.delete(id));
      return next.size !== prev.size ? next : prev;
    });
  }, [tasks]);

  useEffect(() => {
    if (openActionMenuTaskId === null) return;

    const hasActiveTask = tasks.some((task) => task.id === openActionMenuTaskId);
    if (!hasActiveTask) {
      setOpenActionMenuTaskId(null);
    }
  }, [openActionMenuTaskId, tasks]);

  const clearTouchCheckboxClickSuppression = useCallback(() => {
    suppressNextCheckboxClickRef.current = false;

    if (suppressNextCheckboxClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressNextCheckboxClickTimeoutRef.current);
      suppressNextCheckboxClickTimeoutRef.current = null;
    }
  }, []);

  const armTouchCheckboxClickSuppression = useCallback(() => {
    suppressNextCheckboxClickRef.current = true;

    if (suppressNextCheckboxClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressNextCheckboxClickTimeoutRef.current);
    }

    suppressNextCheckboxClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextCheckboxClickRef.current = false;
      suppressNextCheckboxClickTimeoutRef.current = null;
    }, TOUCH_CLICK_SUPPRESSION_RESET_MS);
  }, []);

  const clearTimeSlotLongPress = useCallback(() => {
    const state = timeSlotLongPressRef.current;
    if (state) {
      window.clearTimeout(state.timerId);
      timeSlotLongPressRef.current = null;
    }
  }, []);

  const handleTimeSlotTouchStart = useCallback((slotMinute: number, event: ReactTouchEvent<HTMLDivElement>) => {
    if (!onTimeSlotLongPress) return;
    if (event.touches.length !== 1) return;
    if (isTimeSlotInteractiveTarget(event.target)) return;

    clearTimeSlotLongPress();
    const touch = event.touches[0];
    const timerId = window.setTimeout(() => {
      timeSlotLongPressRef.current = null;
      triggerHaptic(ImpactStyle.Light);
      onTimeSlotLongPress(selectedDate, minuteToTime(slotMinute));
    }, TIME_SLOT_LONG_PRESS_MS);

    timeSlotLongPressRef.current = {
      timerId,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  }, [clearTimeSlotLongPress, onTimeSlotLongPress, selectedDate]);

  const handleTimeSlotTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const state = timeSlotLongPressRef.current;
    if (!state || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - state.startX);
    const deltaY = Math.abs(touch.clientY - state.startY);
    if (deltaX > TIME_SLOT_LONG_PRESS_MOVE_SLOP_PX || deltaY > TIME_SLOT_LONG_PRESS_MOVE_SLOP_PX) {
      clearTimeSlotLongPress();
    }
  }, [clearTimeSlotLongPress]);

  useEffect(() => {
    return () => {
      clearTouchCheckboxClickSuppression();
      clearTimeSlotLongPress();
    };
  }, [clearTimeSlotLongPress, clearTouchCheckboxClickSuppression]);

  const scheduleComboReset = useCallback(() => {
    if (comboResetTimerRef.current !== null) {
      window.clearTimeout(comboResetTimerRef.current);
    }
    comboResetTimerRef.current = window.setTimeout(() => {
      setComboCount(0);
      setShowComboFx(false);
      lastComboAtRef.current = null;
      comboResetTimerRef.current = null;
    }, COMBO_WINDOW_MS);
  }, []);

  const registerCompletionCombo = useCallback(() => {
    const now = Date.now();
    const canChain = lastComboAtRef.current !== null && now - lastComboAtRef.current <= COMBO_WINDOW_MS;
    const nextCombo = canChain ? comboCount + 1 : 1;

    setComboCount(nextCombo);
    lastComboAtRef.current = now;
    scheduleComboReset();

    if (nextCombo > 1) {
      if (comboFxTimerRef.current !== null) {
        window.clearTimeout(comboFxTimerRef.current);
      }
      setShowComboFx(true);
      comboFxTimerRef.current = window.setTimeout(() => {
        setShowComboFx(false);
        comboFxTimerRef.current = null;
      }, useLiteAnimations ? 600 : 1000);
    }
  }, [comboCount, scheduleComboReset, useLiteAnimations]);

  const resetCombo = useCallback(() => {
    if (comboResetTimerRef.current !== null) {
      window.clearTimeout(comboResetTimerRef.current);
      comboResetTimerRef.current = null;
    }
    if (comboFxTimerRef.current !== null) {
      window.clearTimeout(comboFxTimerRef.current);
      comboFxTimerRef.current = null;
    }
    setComboCount(0);
    setShowComboFx(false);
    lastComboAtRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (comboResetTimerRef.current !== null) {
        window.clearTimeout(comboResetTimerRef.current);
      }
      if (comboFxTimerRef.current !== null) {
        window.clearTimeout(comboFxTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    resetCombo();
  }, [selectedDate, resetCombo]);


  // Priority weight for sorting
  const getPriorityWeight = (priority: string | null | undefined) => {
    switch (priority) {
      case 'high': return 0;
      case 'medium': return 1;
      case 'low': return 2;
      default: return 3;
    }
  };

  // Separate ritual tasks (from campaigns) and regular quests
  const { ritualTasks, questTasks } = useMemo(() => {
    const rituals = tasks.filter(t => !!t.habit_source_id);
    const quests = tasks.filter(t => !t.habit_source_id);

    // Sort based on selected sort option
    const sortGroup = (group: Task[]) => {
      let sorted = [...group].sort((a, b) => {
        switch (sortBy) {
          case 'time':
            if (a.scheduled_time && b.scheduled_time) {
              return a.scheduled_time.localeCompare(b.scheduled_time);
            }
            if (a.scheduled_time) return -1;
            if (b.scheduled_time) return 1;
            return 0;
          case 'priority':
            return getPriorityWeight(a.priority) - getPriorityWeight(b.priority);
          case 'xp':
            return b.xp_reward - a.xp_reward;
          case 'custom':
          default: {
            const orderA = a.sort_order ?? 9999;
            const orderB = b.sort_order ?? 9999;
            if (orderA !== orderB) return orderA - orderB;
            if (a.scheduled_time && b.scheduled_time) {
              return a.scheduled_time.localeCompare(b.scheduled_time);
            }
            if (a.scheduled_time) return -1;
            if (b.scheduled_time) return 1;
            return a.id.localeCompare(b.id);
          }
        }
      });

      if (!keepInPlace) {
        const incomplete = sorted.filter(t => !t.completed);
        const complete = sorted.filter(t => t.completed);
        sorted = [...incomplete, ...complete];
      }

      return sorted;
    };

    return {
      ritualTasks: sortGroup(rituals),
      questTasks: sortGroup(quests),
    };
  }, [tasks, sortBy, keepInPlace]);

  const schedulerItems = useMemo(
    () => [...questTasks, ...ritualTasks],
    [questTasks, ritualTasks],
  );

  const scheduledItems = useMemo(
    () => schedulerItems
      .filter((task) => !!task.scheduled_time)
      .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || "")),
    [schedulerItems],
  );
  const anytimeItems = useMemo(
    () => schedulerItems.filter((task) => !task.scheduled_time),
    [schedulerItems],
  );

  useEffect(() => {
    if (anytimeItems.length === 0) {
      setUntimedDrawerOpen(false);
    }
  }, [anytimeItems.length]);

  const baseTimelineItems = useMemo(
    () => [...scheduledItems, ...anytimeItems],
    [scheduledItems, anytimeItems],
  );

  const draggableTimelineItems = baseTimelineItems;

  const timelineDrag = useTimelineDrag({
    containerRef: timelineDragContainerRef,
    enabled: isDesktopTimelineDragEnabled,
    snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
    ...SHARED_TIMELINE_DRAG_INTERACTION_PROFILE,
    onDrop: (taskId, newTime) => {
      const overlapCount = getTaskConflictSetForTask(taskId, draggableTimelineItems, { [taskId]: newTime }).size;
      onUpdateScheduledTime?.(taskId, newTime);
      if (overlapCount > 0) {
        toast(`Overlap: ${overlapCount} quest${overlapCount === 1 ? "" : "s"}`);
      }
    },
  });
  const dragVisualOffsetY = (timelineDrag.dragVisualOffsetY ?? timelineDrag.dragOffsetY) as MotionValue<number>;
  const dragEdgeOffsetY = (timelineDrag.dragEdgeOffsetY ?? dragVisualOffsetY) as MotionValue<number>;
  const timelineIsDragging = isDesktopTimelineDragEnabled && timelineDrag.isDragging;
  const timelineDraggingTaskId = isDesktopTimelineDragEnabled ? timelineDrag.draggingTaskId : null;
  const timelineLongPressTaskId = isDesktopTimelineDragEnabled ? timelineDrag.longPressTaskId : null;
  const timelineJustDroppedId = isDesktopTimelineDragEnabled ? timelineDrag.justDroppedId : null;
  const timelinePreviewTime = isDesktopTimelineDragEnabled ? timelineDrag.previewTime : undefined;
  const timelineZoomRail = isDesktopTimelineDragEnabled ? timelineDrag.zoomRail : null;
  const timelineRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragOverlaySnapshot, setDragOverlaySnapshot] = useState<DragOverlaySnapshot | null>(null);
  const seededDragOverlaySnapshotRef = useRef<DragOverlaySnapshot | null>(null);
  const dragOverlayOffsetY = useMotionValue(0);
  const dragOverlayBottomInsetRef = useRef(DEFAULT_BOTTOM_NAV_SAFE_OFFSET_PX);
  const edgeHoldDirectionRef = useRef<-1 | 0 | 1>(0);
  const edgeHoldRepeatMsRef = useRef<number | null>(null);
  const edgeHoldStepMultiplierRef = useRef(EDGE_HOLD_NEAR_STEP_MULTIPLIER);
  const edgeHoldActivationTimeoutRef = useRef<number | null>(null);
  const edgeHoldRepeatIntervalRef = useRef<number | null>(null);
  const edgeHoldIsActiveRef = useRef(false);

  const [nowMarkerMinute, setNowMarkerMinute] = useState(() => parseTimeToMinute(format(new Date(), "HH:mm")) ?? 0);
  const isTodaySelected = isSameDay(selectedDate, new Date());
  nowMarkerMinuteRef.current = nowMarkerMinute;
  const nowMarkerRowRef = useRef<HTMLDivElement | null>(null);
  const wasVisibleRef = useRef(isVisible);
  const wasTodayRef = useRef(isTodaySelected);
  const hadNowMarkerRef = useRef(false);
  const lastCenterNowRequestKeyRef = useRef(centerNowRequestKey);

  const captureDragOverlaySnapshotForTask = useCallback((taskId: string): DragOverlaySnapshot | null => {
    const rowNode = timelineRowRefs.current.get(taskId);
    if (!rowNode) return null;

    const rect = rowNode.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : rowNode.clientWidth || rowNode.offsetWidth || 1;
    const height = rect.height > 0 ? rect.height : rowNode.clientHeight || rowNode.offsetHeight || 1;
    return {
      taskId,
      top: rect.top,
      left: rect.left,
      width,
      height,
    };
  }, []);

  const seedDragOverlaySnapshotForTask = useCallback((taskId: string) => {
    seededDragOverlaySnapshotRef.current = captureDragOverlaySnapshotForTask(taskId);
    if (seededDragOverlaySnapshotRef.current) {
      dragOverlayBottomInsetRef.current = getBottomNavObstructionPx();
    }
  }, [captureDragOverlaySnapshotForTask]);

  const clearEdgeHoldActivationTimer = useCallback(() => {
    if (edgeHoldActivationTimeoutRef.current !== null) {
      window.clearTimeout(edgeHoldActivationTimeoutRef.current);
      edgeHoldActivationTimeoutRef.current = null;
    }
  }, []);

  const clearEdgeHoldRepeatTimer = useCallback(() => {
    if (edgeHoldRepeatIntervalRef.current !== null) {
      window.clearInterval(edgeHoldRepeatIntervalRef.current);
      edgeHoldRepeatIntervalRef.current = null;
    }
  }, []);

  const stopEdgeHold = useCallback(() => {
    edgeHoldDirectionRef.current = 0;
    edgeHoldRepeatMsRef.current = null;
    edgeHoldStepMultiplierRef.current = EDGE_HOLD_NEAR_STEP_MULTIPLIER;
    edgeHoldIsActiveRef.current = false;
    clearEdgeHoldActivationTimer();
    clearEdgeHoldRepeatTimer();
  }, [clearEdgeHoldActivationTimer, clearEdgeHoldRepeatTimer]);

  const startEdgeHoldInterval = useCallback(
    (direction: -1 | 1, repeatMs: number, stepMultiplier: number) => {
      clearEdgeHoldRepeatTimer();
      edgeHoldStepMultiplierRef.current = Math.max(1, stepMultiplier);
      edgeHoldIsActiveRef.current = true;
      edgeHoldRepeatIntervalRef.current = window.setInterval(() => {
        if (!timelineIsDragging || edgeHoldDirectionRef.current !== direction) {
          edgeHoldIsActiveRef.current = false;
          clearEdgeHoldRepeatTimer();
          return;
        }

        const activeStepMultiplier = Math.max(1, edgeHoldStepMultiplierRef.current);
        for (let step = 0; step < activeStepMultiplier; step += 1) {
          const nudged = timelineDrag.nudgeByFineStep(direction);
          if (!nudged) {
            edgeHoldIsActiveRef.current = false;
            clearEdgeHoldRepeatTimer();
            return;
          }
        }
      }, repeatMs);
    },
    [clearEdgeHoldRepeatTimer, timelineDrag.nudgeByFineStep, timelineIsDragging],
  );

  const syncEdgeHoldState = useCallback(
    (nextDirection: -1 | 0 | 1, nextProfile: EdgeHoldProfile | null) => {
      if (!timelineIsDragging || nextDirection === 0 || nextProfile === null) {
        stopEdgeHold();
        return;
      }

      const nextRepeatMs = nextProfile.repeatMs;
      const nextStepMultiplier = nextProfile.stepMultiplier;
      const previousDirection = edgeHoldDirectionRef.current;
      const previousRepeatMs = edgeHoldRepeatMsRef.current;
      const previousStepMultiplier = edgeHoldStepMultiplierRef.current;
      const directionChanged = previousDirection !== nextDirection;
      const repeatChanged = previousRepeatMs !== nextRepeatMs;
      const stepMultiplierChanged = previousStepMultiplier !== nextStepMultiplier;

      edgeHoldDirectionRef.current = nextDirection;
      edgeHoldRepeatMsRef.current = nextRepeatMs;
      edgeHoldStepMultiplierRef.current = nextStepMultiplier;

      if (directionChanged) {
        edgeHoldIsActiveRef.current = false;
        clearEdgeHoldActivationTimer();
        clearEdgeHoldRepeatTimer();

        edgeHoldActivationTimeoutRef.current = window.setTimeout(() => {
          edgeHoldActivationTimeoutRef.current = null;
          if (!timelineIsDragging || edgeHoldDirectionRef.current !== nextDirection) {
            return;
          }

          const activeRepeatMs = edgeHoldRepeatMsRef.current;
          if (activeRepeatMs === null) {
            stopEdgeHold();
            return;
          }
          const activeStepMultiplier = Math.max(1, edgeHoldStepMultiplierRef.current);
          startEdgeHoldInterval(nextDirection, activeRepeatMs, activeStepMultiplier);
        }, EDGE_HOLD_ACTIVATION_MS);
        return;
      }

      if (!edgeHoldIsActiveRef.current) {
        return;
      }

      if (repeatChanged || stepMultiplierChanged) {
        startEdgeHoldInterval(nextDirection, nextRepeatMs, nextStepMultiplier);
      }
    },
    [
      clearEdgeHoldActivationTimer,
      clearEdgeHoldRepeatTimer,
      startEdgeHoldInterval,
      stopEdgeHold,
      timelineIsDragging,
    ],
  );

  useLayoutEffect(() => {
    const draggingTaskId = timelineDraggingTaskId;
    if (!draggingTaskId) {
      setDragOverlaySnapshot(null);
      dragOverlayOffsetY.set(0);
      seededDragOverlaySnapshotRef.current = null;
      return;
    }

    const seededSnapshot = seededDragOverlaySnapshotRef.current;
    if (seededSnapshot && seededSnapshot.taskId === draggingTaskId) {
      setDragOverlaySnapshot(seededSnapshot);
      dragOverlayBottomInsetRef.current = getBottomNavObstructionPx();
      return;
    }

    seededDragOverlaySnapshotRef.current = null;
    let frameId: number | null = null;

    const captureSnapshot = () => {
      const nextSnapshot = captureDragOverlaySnapshotForTask(draggingTaskId);
      if (!nextSnapshot) return false;
      setDragOverlaySnapshot(nextSnapshot);
      dragOverlayBottomInsetRef.current = getBottomNavObstructionPx();
      return true;
    };

    if (!captureSnapshot() && typeof window !== "undefined") {
      frameId = window.requestAnimationFrame(() => {
        captureSnapshot();
      });
    }

    return () => {
      if (frameId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [captureDragOverlaySnapshotForTask, dragOverlayOffsetY, timelineDraggingTaskId]);

  useEffect(() => {
    if (!timelineIsDragging || !dragOverlaySnapshot) {
      dragOverlayOffsetY.set(0);
      stopEdgeHold();
      return;
    }

    const clampDragOffset = (rawVisualOffsetY: number, rawEdgeOffsetY: number) => {
      const viewport = window.visualViewport;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const viewportTopInset = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTopInset + viewportHeight;
      const paneRect = scheduledPaneRef.current?.getBoundingClientRect();
      const navRect = document
        .querySelector('nav[aria-label="Main navigation"]')
        ?.getBoundingClientRect();

      const hasMeasurablePaneBounds = !!paneRect
        && Number.isFinite(paneRect.top)
        && Number.isFinite(paneRect.bottom)
        && paneRect.bottom > (paneRect.top + 1);
      const hasMeasurableNavBounds = !!navRect
        && Number.isFinite(navRect.top)
        && Number.isFinite(navRect.bottom)
        && navRect.bottom > navRect.top;
      const timelineTopBound = hasMeasurablePaneBounds ? paneRect.top : viewportTopInset;
      const timelineBottomBound = hasMeasurablePaneBounds ? paneRect.bottom : viewportBottom;
      const viewportSafeMaxTop = viewportBottom - dragOverlayBottomInsetRef.current - dragOverlaySnapshot.height;
      const paneBoundMaxTop = timelineBottomBound - dragOverlaySnapshot.height - DRAG_OVERLAY_BOTTOM_PADDING_PX;
      const navBoundMaxTop = hasMeasurableNavBounds
        ? navRect.top - dragOverlaySnapshot.height - DRAG_OVERLAY_NAV_GAP_PX
        : null;

      const minTop = Math.max(viewportTopInset, timelineTopBound) + DRAG_OVERLAY_TOP_PADDING_PX;
      const maxTop = navBoundMaxTop !== null
        ? Math.min(navBoundMaxTop, viewportSafeMaxTop)
        : hasMeasurablePaneBounds
          ? paneBoundMaxTop
          : viewportSafeMaxTop;
      const safeMaxTop = Math.max(minTop, maxTop);

      const minOffset = minTop - dragOverlaySnapshot.top;
      const maxOffset = safeMaxTop - dragOverlaySnapshot.top;
      const clampedVisualOffset = Math.max(minOffset, Math.min(maxOffset, rawVisualOffsetY));
      dragOverlayOffsetY.set(clampedVisualOffset);

      const clampedEdgeOffset = Math.max(minOffset, Math.min(maxOffset, rawEdgeOffsetY));
      const clampDeltaEdge = rawEdgeOffsetY - clampedEdgeOffset;
      const topPinActivationOvershootPx = EDGE_HOLD_PIN_THRESHOLD_PX + EDGE_HOLD_TOP_NEUTRAL_OVERSHOOT_PX;
      const bottomOvershootPx = clampDeltaEdge > EDGE_HOLD_PIN_THRESHOLD_PX
        ? clampDeltaEdge
        : 0;
      const topOvershootPx = clampDeltaEdge < -topPinActivationOvershootPx
        ? Math.abs(clampDeltaEdge) - EDGE_HOLD_TOP_NEUTRAL_OVERSHOOT_PX
        : 0;
      const pinnedDirection: -1 | 0 | 1 = bottomOvershootPx > 0
        ? 1
        : topOvershootPx > 0
          ? -1
          : 0;
      const effectiveOvershootPx = pinnedDirection === 1
        ? bottomOvershootPx
        : pinnedDirection === -1
          ? topOvershootPx
          : 0;
      const edgeHoldProfile = resolveEdgeHoldProfile(effectiveOvershootPx);
      syncEdgeHoldState(pinnedDirection, edgeHoldProfile);
    };

    clampDragOffset(dragVisualOffsetY.get(), dragEdgeOffsetY.get());
    const unsubscribeVisualOffset = dragVisualOffsetY.on("change", (nextVisualOffset) => {
      clampDragOffset(nextVisualOffset, dragEdgeOffsetY.get());
    });
    const unsubscribeEdgeOffset = dragEdgeOffsetY === dragVisualOffsetY
      ? null
      : dragEdgeOffsetY.on("change", (nextEdgeOffset) => {
          clampDragOffset(dragVisualOffsetY.get(), nextEdgeOffset);
        });
    const handleViewportChange = () => clampDragOffset(dragVisualOffsetY.get(), dragEdgeOffsetY.get());

    window.addEventListener("resize", handleViewportChange);
    const viewport = window.visualViewport;
    const canListenToViewport = !!viewport
      && typeof viewport.addEventListener === "function"
      && typeof viewport.removeEventListener === "function";
    if (canListenToViewport) {
      viewport.addEventListener("resize", handleViewportChange);
      viewport.addEventListener("scroll", handleViewportChange);
    }

    return () => {
      unsubscribeVisualOffset();
      unsubscribeEdgeOffset?.();
      stopEdgeHold();
      window.removeEventListener("resize", handleViewportChange);
      if (canListenToViewport) {
        viewport.removeEventListener("resize", handleViewportChange);
        viewport.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, [dragEdgeOffsetY, dragOverlayOffsetY, dragOverlaySnapshot, dragVisualOffsetY, stopEdgeHold, syncEdgeHoldState, timelineIsDragging]);

  useEffect(() => {
    if (timelineIsDragging) return;
    stopEdgeHold();
  }, [stopEdgeHold, timelineIsDragging]);

  useEffect(() => {
    return () => {
      stopEdgeHold();
    };
  }, [stopEdgeHold]);

  useEffect(() => {
    if (!isTodaySelected) return;

    const tick = () => {
      const minute = parseTimeToMinute(format(new Date(), "HH:mm")) ?? 0;
      setNowMarkerMinute(minute);
    };

    tick();
    const interval = window.setInterval(tick, 60_000);
    return () => window.clearInterval(interval);
  }, [isTodaySelected, selectedDate]);

  const scheduledFlow = useMemo(
    () => buildTaskTimelineFlow(scheduledItems),
    [scheduledItems],
  );

  const scheduledItemsById = useMemo(
    () => new Map(scheduledItems.map((task) => [task.id, task])),
    [scheduledItems],
  );

  const flowOrderedScheduledItems = useMemo(() => {
    if (scheduledFlow.orderedTaskIds.length === 0) return scheduledItems;

    const ordered: Task[] = [];
    for (const taskId of scheduledFlow.orderedTaskIds) {
      const task = scheduledItemsById.get(taskId);
      if (task) {
        ordered.push(task);
      }
    }

    return ordered.length > 0 ? ordered : scheduledItems;
  }, [scheduledFlow.orderedTaskIds, scheduledItems, scheduledItemsById]);

  const fullDaySlotMinutes = useMemo(() => buildFullDaySlotMinutes(), []);

  const positionedTimelineTasks = useMemo(() => (
    flowOrderedScheduledItems
      .map((task) => {
        const flow = scheduledFlow.byTaskId.get(task.id);
        const startMinute = flow?.startMinute ?? parseTimeToMinute(task.scheduled_time);
        if (startMinute === null) return null;

        const laneCount = Math.max(1, flow?.laneCount ?? 1);
        const laneIndex = Math.min(laneCount - 1, Math.max(0, flow?.laneIndex ?? 0));
        const widthPercent = 100 / laneCount;
        const leftPercent = laneIndex * widthPercent;
        const heightPx = durationMinutesToPixels(task.estimated_duration, {
          fallbackMinutes: timedTaskDurationFallbackMinutes,
          minHeightPx: OUTLOOK_TIMELINE_MIN_EVENT_HEIGHT_PX,
          pxPerMinute: OUTLOOK_TIMELINE_PX_PER_MINUTE,
        });

        return {
          task,
          startMinute,
          topPx: getTimelineTopPx(startMinute),
          heightPx,
          laneIndex,
          laneCount,
          overlapCount: flow?.overlapCount ?? 0,
          leftPercent,
          widthPercent,
        };
      })
      .filter((entry): entry is {
        task: Task;
        startMinute: number;
        topPx: number;
        heightPx: number;
        laneIndex: number;
        laneCount: number;
        overlapCount: number;
        leftPercent: number;
        widthPercent: number;
      } => entry !== null)
  ), [flowOrderedScheduledItems, scheduledFlow.byTaskId, timedTaskDurationFallbackMinutes]);

  const hasRenderableNowMarker = isTodaySelected;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const updateScheduledPaneBounds = () => {
      const pane = scheduledPaneRef.current;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      if (!pane) {
        setTimelineBodyHeightPx(null);
        return;
      }

      const viewportBottom = (window.visualViewport?.offsetTop ?? 0) + viewportHeight;
      const bottomOffset = getBottomNavObstructionPx();
      const available = Math.floor(viewportBottom - pane.getBoundingClientRect().top - bottomOffset);
      if (!Number.isFinite(available)) return;
      setTimelineBodyHeightPx(Math.max(120, available));
    };

    const rafId = window.requestAnimationFrame(updateScheduledPaneBounds);
    updateScheduledPaneBounds();
    window.addEventListener("resize", updateScheduledPaneBounds);
    const viewport = window.visualViewport;
    const canListenToViewport = !!viewport
      && typeof viewport.addEventListener === "function"
      && typeof viewport.removeEventListener === "function";
    if (canListenToViewport) {
      viewport.addEventListener("resize", updateScheduledPaneBounds);
      viewport.addEventListener("scroll", updateScheduledPaneBounds);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateScheduledPaneBounds);
      if (canListenToViewport) {
        viewport.removeEventListener("resize", updateScheduledPaneBounds);
        viewport.removeEventListener("scroll", updateScheduledPaneBounds);
      }
    };
  }, [comboCount, hasRenderableNowMarker, isDesktopLayout, isTodaySelected, positionedTimelineTasks.length, tasks.length]);

  useEffect(() => {
    const isToday = isTodaySelected;
    const becameVisible = isVisible && !wasVisibleRef.current;
    const becameToday = isToday && !wasTodayRef.current;
    const gainedNowMarker = hasRenderableNowMarker && !hadNowMarkerRef.current;
    const centerRequestChanged = centerNowRequestKey !== lastCenterNowRequestKeyRef.current;
    const shouldCenter =
      isVisible &&
      isToday &&
      hasRenderableNowMarker &&
      !timelineIsDragging &&
      (becameVisible || becameToday || gainedNowMarker || centerRequestChanged);

    if (shouldCenter && typeof window !== "undefined") {
      const pane = scheduledPaneRef.current;
      if (pane) {
        const paneHeight = pane.clientHeight || timelineBodyHeightPx || (window.visualViewport?.height ?? window.innerHeight);
        const markerTop = getTimelineTopPx(nowMarkerMinuteRef.current);
        const targetPaneScrollTop = markerTop - (paneHeight * NOW_MARKER_VIEWPORT_TARGET);
        const maxPaneScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        pane.scrollTo({
          top: Math.max(0, Math.min(maxPaneScrollTop, targetPaneScrollTop)),
          behavior: "smooth",
        });
      } else if (nowMarkerRowRef.current) {
        const markerRect = nowMarkerRowRef.current.getBoundingClientRect();
        const markerMidpoint = markerRect.top + (markerRect.height / 2);
        const targetScrollTop = Math.max(
          0,
          window.scrollY + markerMidpoint - (window.innerHeight * NOW_MARKER_VIEWPORT_TARGET),
        );
        window.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      }
    }

    wasVisibleRef.current = isVisible;
    wasTodayRef.current = isToday;
    hadNowMarkerRef.current = hasRenderableNowMarker;
    lastCenterNowRequestKeyRef.current = centerNowRequestKey;
  }, [centerNowRequestKey, hasRenderableNowMarker, isTodaySelected, isVisible, timelineBodyHeightPx, timelineIsDragging]);

  const baseTimelineConflictMap = useMemo(
    () => buildTaskConflictMap(draggableTimelineItems),
    [draggableTimelineItems],
  );

  const timelineConflictMap = baseTimelineConflictMap;
  const draggedScheduledTask = useMemo(() => {
    if (!timelineDraggingTaskId) return null;
    return scheduledItemsById.get(timelineDraggingTaskId) ?? null;
  }, [scheduledItemsById, timelineDraggingTaskId]);
  const draggedScheduledFlow = useMemo(() => {
    if (!draggedScheduledTask) return null;
    return scheduledFlow.byTaskId.get(draggedScheduledTask.id) ?? null;
  }, [draggedScheduledTask, scheduledFlow.byTaskId]);
  const shouldRenderDragOverlay = Boolean(
    timelineIsDragging &&
      dragOverlaySnapshot &&
      draggedScheduledTask &&
      dragOverlaySnapshot.taskId === draggedScheduledTask.id,
  );
  const draggedLaneOffsetPx = draggedScheduledFlow
    ? getLaneOffsetPx(draggedScheduledFlow.laneIndex, draggedScheduledFlow.overlapCount)
    : 0;
  const draggedOverlapCount = draggedScheduledTask
    ? timelineConflictMap.get(draggedScheduledTask.id)?.size ?? 0
    : 0;

  const activeEpicsById = useMemo(() => {
    const map = new Map<string, ActiveEpic>();
    for (const epic of activeEpics) {
      map.set(epic.id, epic);
    }
    return map;
  }, [activeEpics]);

  // Group rituals by campaign, using task-level fallback data until epics hydrate.
  const campaignRitualGroups = useMemo(() => {
    const ritualsByEpic = new Map<string, { title: string; rituals: Task[] }>();

    for (const task of ritualTasks) {
      const epicId = task.epic_id;
      if (!epicId) continue;

      const fallbackTitle = task.epic_title?.trim() || "Campaign";
      const existingGroup = ritualsByEpic.get(epicId);
      if (existingGroup) {
        existingGroup.rituals.push(task);
        if (existingGroup.title === "Campaign" && fallbackTitle !== "Campaign") {
          existingGroup.title = fallbackTitle;
        }
        continue;
      }

      ritualsByEpic.set(epicId, {
        title: fallbackTitle,
        rituals: [task],
      });
    }

    return Array.from(ritualsByEpic.entries()).map(([epicId, group]) => {
      const epic = activeEpicsById.get(epicId) ?? null;
      return {
        epicId,
        title: epic?.title || group.title || "Campaign",
        progress: epic ? Math.round(epic.progress_percentage ?? 0) : null,
        daysLeft: epic ? getDaysLeft(epic) : null,
        rituals: group.rituals,
        completedCount: group.rituals.filter((ritual) => !!ritual.completed).length,
        epic,
        isHydrated: !!epic,
      };
    });
  }, [ritualTasks, activeEpicsById]);

  const campaignRitualEpicIds = useMemo(
    () => new Set(campaignRitualGroups.map((group) => group.epicId)),
    [campaignRitualGroups],
  );

  const activeEpicsWithoutRitualGroup = useMemo(
    () => activeEpics.filter((epic) => !campaignRitualEpicIds.has(epic.id)),
    [activeEpics, campaignRitualEpicIds],
  );

  const renderCampaignSectionLabel = (label: string) => {
    const className = "flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground";
    const contents = (
      <>
        <Target className="h-3 w-3" />
        {label}
      </>
    );

    return onOpenCampaigns ? (
      <button
        type="button"
        aria-label="Open campaigns page"
        onClick={onOpenCampaigns}
        className={cn(
          className,
          "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        {contents}
      </button>
    ) : (
      <div className={className}>
        {contents}
      </div>
    );
  };

  const renderCampaignSection = ({ inDesktopRail = false }: { inDesktopRail?: boolean } = {}) => {
    const sectionLabel = inDesktopRail ? "Campaigns & rituals" : "Campaigns";
    const campaignSectionHeader = (
      <div className="flex items-center gap-2 mb-3">
        {!inDesktopRail && <div className="w-9 flex-shrink-0" />}
        {renderCampaignSectionLabel(sectionLabel)}
        <div className="flex-1 border-t border-dashed border-border/40" />
      </div>
    );

    return (
      <>
      {/* Campaign quick-view launchers; ritual tasks render in the normal scheduler timeline. */}
      {campaignRitualGroups.length > 0 && (
        <div className={cn(inDesktopRail ? "space-y-3" : "mt-6 pt-4 border-t border-border/30")}>
          {campaignSectionHeader}

          <div className="space-y-2">
            {campaignRitualGroups.map((group) => {
              const resolvedEndDate = group.epic ? resolveEpicEndDate(group.epic) : null;
              return (
                group.epic && group.isHydrated ? (
                  <JourneyPathDrawer key={group.epicId} epic={{
                    id: group.epic.id,
                    title: group.epic.title,
                    description: group.epic.description ?? undefined,
                    progress_percentage: group.epic.progress_percentage ?? 0,
                    target_days: group.epic.target_days,
                    start_date: group.epic.start_date,
                    end_date: resolvedEndDate,
                    epic_habits: group.epic.epic_habits,
                  }}>
                    <button
                      type="button"
                      aria-label={`Open campaign ${group.title}`}
                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border/30 bg-card/30 px-3 py-2.5 text-left hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Target className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{group.title}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {group.progress !== null && (
                          <span className="text-primary font-bold text-xs">{group.progress}%</span>
                        )}
                        {group.daysLeft !== null && (
                          <span className="text-muted-foreground text-xs">{group.daysLeft}d</span>
                        )}
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                          {group.completedCount}/{group.rituals.length}
                        </Badge>
                      </span>
                    </button>
                  </JourneyPathDrawer>
                ) : (
                  <div
                    key={group.epicId}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border/30 bg-card/30 px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Target className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate">{group.title}</span>
                    </span>
                    <Badge variant="secondary" className="text-xs h-5 px-1.5">
                      {group.completedCount}/{group.rituals.length}
                    </Badge>
                  </div>
                )
              );
            })}
          </div>
        </div>
      )}

      {activeEpicsWithoutRitualGroup.length > 0 && campaignRitualGroups.length > 0 && (
        <div className={cn(inDesktopRail ? "mt-3 space-y-2" : "mt-3 space-y-2")}>
          {activeEpicsWithoutRitualGroup.map((epic) => {
            const progress = Math.round(epic.progress_percentage ?? 0);
            const daysLeft = getDaysLeft(epic);
            const resolvedEndDate = resolveEpicEndDate(epic);
            return (
              <JourneyPathDrawer key={epic.id} epic={{
                id: epic.id,
                title: epic.title,
                description: epic.description ?? undefined,
                progress_percentage: epic.progress_percentage ?? 0,
                target_days: epic.target_days,
                start_date: epic.start_date,
                end_date: resolvedEndDate,
                epic_habits: epic.epic_habits,
              }}>
                <button
                  type="button"
                  aria-label={`Open campaign ${epic.title}`}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/30 bg-card/30 px-3 py-2 text-left hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Target className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate max-w-[140px]">{epic.title}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-primary font-bold text-xs">{progress}%</span>
                    {daysLeft !== null && (
                      <span className="text-muted-foreground text-xs">{daysLeft}d</span>
                    )}
                  </span>
                </button>
              </JourneyPathDrawer>
            );
          })}
        </div>
      )}

      {isCampaignsLoading && campaignRitualGroups.length === 0 && (
        <div className={cn(inDesktopRail ? "rounded-[24px] border border-white/8 bg-white/[0.03] p-4" : "mt-4 pt-3 border-t border-border/20")}>
          <p className="text-xs text-muted-foreground">Loading campaigns...</p>
        </div>
      )}

      {/* Campaign Strip (for epics with no rituals today) */}
      {activeEpics.length > 0 && campaignRitualGroups.length === 0 && (
        <div className={cn(inDesktopRail ? "space-y-3" : "mt-4 pt-3 border-t border-border/20")}>
          {campaignSectionHeader}

          <div className="space-y-2">
            {activeEpics.map((epic) => {
              const progress = Math.round(epic.progress_percentage ?? 0);
              const daysLeft = getDaysLeft(epic);
              const resolvedEndDate = resolveEpicEndDate(epic);
              return (
                <JourneyPathDrawer key={epic.id} epic={{
                  id: epic.id,
                  title: epic.title,
                  description: epic.description ?? undefined,
                  progress_percentage: epic.progress_percentage ?? 0,
                  target_days: epic.target_days,
                  start_date: epic.start_date,
                  end_date: resolvedEndDate,
                  epic_habits: epic.epic_habits,
                }}>
                  <button
                    type="button"
                    aria-label={`Open campaign ${epic.title}`}
                    className="w-full rounded-xl border border-border/30 bg-card/30 px-3 py-2 text-left hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Target className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[140px]">{epic.title}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-primary font-bold text-xs shrink-0">{progress}%</span>
                        {daysLeft !== null && (
                          <span className="text-muted-foreground text-xs shrink-0">{daysLeft}d</span>
                        )}
                      </div>
                    </div>
                  </button>
                </JourneyPathDrawer>
              );
            })}
          </div>
        </div>
      )}
      </>
    );
  };





  const totalXP = tasks.reduce((sum, task) => {
    if (!task.completed) return sum;
    const taskXP = task.is_main_quest
      ? Math.round(task.xp_reward * MAIN_QUEST_XP_MULTIPLIER)
      : task.xp_reward;
    return sum + taskXP;
  }, 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const weekCompletedCount = weekTasks.filter((task) => task.completed).length;
  const weekTotalCount = weekTasks.length;
  const weekScheduledCount = weekTasks.filter((task) => !!task.scheduled_time).length;
  const weekActiveDays = new Set(weekTasks.map((task) => task.task_date)).size;
  const weekXP = weekTasks.reduce((sum, task) => {
    if (!task.completed) return sum;
    const taskXP = task.is_main_quest
      ? Math.round(task.xp_reward * MAIN_QUEST_XP_MULTIPLIER)
      : task.xp_reward;
    return sum + taskXP;
  }, 0);
  const selectedScheduledCount = scheduledItems.length;
  const selectedAnytimeCount = anytimeItems.length;
  const selectedRitualCount = ritualTasks.length;
  const selectedOpenCount = totalCount - completedCount;
  const nextFocusTask = baseTimelineItems.find((task) => !task.completed) ?? null;
  const selectedDateHeading = safeFormat(selectedDate, "EEEE", "Day plan");
  const selectedDateSubheading = safeFormat(selectedDate, "MMMM d, yyyy", "");
  const isSelectedToday = isSameDay(selectedDate, new Date());
  const desktopTimelineDurationLayout = isDesktopLayout && useMacDurationSizedDesktopTimelineRows
    ? {
        fallbackMinutes: timedTaskDurationFallbackMinutes,
        minHeightPx: DESKTOP_TIMELINE_DURATION_BASE_HEIGHT_PX,
        pxPerMinute: DESKTOP_TIMELINE_DURATION_BASE_HEIGHT_PX / DESKTOP_TIMELINE_DURATION_BASE_MINUTES,
      }
    : null;

  const triggerHaptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Haptics not available on web
    }
  };

  // Check if a task has expandable details
  const hasExpandableDetails = useCallback((task: Task) => {
    const displayAttachments = normalizeDisplayAttachments(task);
    const ritualDescription = task.habit_source_id
      ? habitDescriptionById.get(task.habit_source_id) ?? null
      : null;
    return !!(
      (task.subtasks && task.subtasks.length > 0) ||
      displayAttachments.length > 0 ||
      normalizeDetailText(ritualDescription) ||
      task.location ||
      task.notes ||
      task.priority ||
      task.estimated_duration ||
      (task.is_recurring && task.recurrence_pattern) ||
      task.difficulty ||
      task.category
    );
  }, [habitDescriptionById]);

  const toggleTaskExpanded = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const getCategoryIcon = (category: string | null | undefined) => {
    switch (category) {
      case 'mind': return Brain;
      case 'body': return Dumbbell;
      case 'soul': return Heart;
      default: return null;
    }
  };

  const suppressNativeContextMenu = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  }, []);

  const renderTaskItem = useCallback((
    task: Task,
    dragProps?: ListDragHandleProps,
    overlapCount = 0,
    timelineContext?: TimelineTaskRenderContext,
  ) => {
    const isComplete = !!task.completed || optimisticCompleted.has(task.id);
    const isRitual = !!task.habit_source_id;
    const isCampaignRitual = isCampaignRitualTask(task);
    const campaignTitle = task.epic_title?.trim() || "Campaign";
    const effectiveTaskXP = task.is_main_quest
      ? Math.round(task.xp_reward * MAIN_QUEST_XP_MULTIPLIER)
      : task.xp_reward;
    const isDragging = dragProps?.isDragging ?? false;
    const isPressed = dragProps?.isPressed ?? false;
    const isActivated = dragProps?.isActivated ?? false;
    const isActionMenuOpen = openActionMenuTaskId === task.id;
    const isExpanded = expandedTasks.has(task.id);
    const isScheduledTimelineItem = timelineContext?.isScheduledTimeline === true;
    const isCompactTimelineItem = isScheduledTimelineItem && timelineContext?.isCompact === true;
    const canRenderInlineDetails = !isScheduledTimelineItem;
    const isInlineExpanded = canRenderInlineDetails && isExpanded;
    const hasDetails = hasExpandableDetails(task);
    const CategoryIcon = getCategoryIcon(task.category);
    const subtasks = task.subtasks ?? [];
    const displayAttachments = normalizeDisplayAttachments(task);
    const completedSubtaskCount = subtasks.filter(subtask => !!subtask.completed).length;
    const ritualDescription = isRitual && task.habit_source_id
      ? habitDescriptionById.get(task.habit_source_id) ?? null
      : null;
    const normalizedRitualDescription = normalizeDetailText(ritualDescription);
    const normalizedTaskNotes = normalizeDetailText(task.notes);
    const shouldRenderRitualDescription = normalizedRitualDescription.length > 0;
    const shouldRenderNotes = normalizedTaskNotes.length > 0 && normalizedTaskNotes !== normalizedRitualDescription;
    const hasDetailBadges = !!(
      (CategoryIcon && task.category) ||
      task.difficulty ||
      task.priority ||
      task.estimated_duration ||
      (task.is_recurring && task.recurrence_pattern)
    );
    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Don't allow clicks while dragging or during long press
      if (isDragging || isActivated || isPressed) {
        e.preventDefault();
        return;
      }

      if (isComplete && onUndoToggle) {
        // Undo: remove from optimistic set
        setOptimisticCompleted(prev => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
        resetCombo();
        triggerHaptic(ImpactStyle.Light);
        onUndoToggle(task.id, effectiveTaskXP);
      } else {
        // Complete: add to optimistic set immediately for instant strikethrough
        setOptimisticCompleted(prev => new Set(prev).add(task.id));
        registerCompletionCombo();
        triggerHaptic(ImpactStyle.Medium);
        playStrikethrough();
        // Track for strikethrough animation
        setJustCompletedTasks(prev => new Set(prev).add(task.id));
        setTimeout(() => {
          setJustCompletedTasks(prev => {
            const next = new Set(prev);
            next.delete(task.id);
            return next;
          });
        }, 600);

        onToggle(task.id, !isComplete, effectiveTaskXP);
      }
    };

    if (isDesktopLayout) {
      const isDesktopDetailOpen = openDesktopDetailTaskId === task.id;

      return (
        <div
          data-quest-card-shell="true"
          className={cn(
            JOURNEYS_QUEST_CARD_SHELL_CLASS_NAME,
            "group flex h-full items-stretch gap-2 rounded-[18px] p-2",
            readableQuestCardsEnabled
              ? JOURNEYS_QUEST_CARD_SHELL_READABLE_CLASS_NAME
              : JOURNEYS_QUEST_CARD_SHELL_STANDARD_TONE_CLASS_NAME,
            isCampaignRitual && (
              readableQuestCardsEnabled
                ? CAMPAIGN_RITUAL_CARD_CLASS_NAME
                : CAMPAIGN_RITUAL_CARD_CLASSES
            ),
            isDesktopDetailOpen && JOURNEYS_QUEST_CARD_SHELL_ACTIVE_CLASS_NAME,
            isDesktopDetailOpen && !readableQuestCardsEnabled && "border-primary/40 bg-primary/[0.08]",
            isComplete && "opacity-70",
          )}
          onContextMenu={suppressNativeContextMenu}
        >
          <button
            type="button"
            data-interactive="true"
            onClick={handleCheckboxClick}
            className={cn(
              "flex h-5 w-5 flex-shrink-0 self-center items-center justify-center rounded-full border-2 transition-colors",
              isComplete
                ? "border-primary bg-primary text-primary-foreground"
                : "border-white/25 text-transparent hover:border-primary/70",
            )}
            aria-label={
              isComplete
                ? "Mark task as incomplete"
                : "Mark task as complete"
            }
            role="checkbox"
            aria-checked={isComplete}
          >
            <Check className="h-3 w-3" />
          </button>

          <DesktopQuestDetailsPopover
            task={task}
            open={isDesktopDetailOpen}
            onOpenChange={(open) => {
              setOpenDesktopDetailTaskId(open ? task.id : null);
            }}
            hasCalendarLink={hasCalendarLink?.(task.id)}
            onEdit={onEditQuest}
            onDelete={onDeleteQuest ? (currentTask) => onDeleteQuest(currentTask.id) : undefined}
            onMoveQuestToNextDay={
              onMoveQuestToNextDay && !isRitual
                ? (currentTask) => onMoveQuestToNextDay(currentTask.id)
                : undefined
            }
            onSendToCalendar={onSendToCalendar}
            onToggleSubtask={(taskId, subtaskId, completed) => {
              toggleSubtask.mutate({ taskId, subtaskId, completed });
            }}
            companionFrostedThemeStyle={companionFrostedThemeStyle}
            anchor={(
              <button
                type="button"
                onClick={() => scheduleDesktopTaskSingleClick(task)}
                onDoubleClick={() => handleDesktopTaskDoubleClick(task)}
                className="flex h-full min-w-0 flex-1 items-center rounded-[14px] px-2 py-1.5 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                data-testid={`desktop-timeline-task-button-${task.id}`}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    {isRitual ? (
                      <Repeat
                        className={cn(
                          "h-3.5 w-3.5 flex-shrink-0",
                          isCampaignRitual ? "text-primary" : "text-accent",
                        )}
                      />
                    ) : null}
                    <p
                      className={cn(
                        "truncate text-sm font-medium text-foreground",
                        isComplete && "text-muted-foreground line-through",
                      )}
                    >
                      {task.task_text}
                    </p>
                  </div>
                  {isCampaignRitual ? (
                    <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-primary/80">
                      Campaign Ritual - {campaignTitle}
                    </p>
                  ) : null}
                </div>
              </button>
            )}
          />
        </div>
      );
    }

    const isMobileQuestShellActive = isInlineExpanded || (isActivated && !isDragging);
    const taskContent = (
      <Collapsible
        open={isInlineExpanded}
        onOpenChange={() => {}}
        className={cn(isCompactTimelineItem && "h-full min-h-0")}
      >
        <div
          data-quest-card-shell="true"
          data-scheduled-timeline-card={isScheduledTimelineItem ? "true" : undefined}
          data-compact-timeline-card={isCompactTimelineItem ? "true" : undefined}
          data-timeline-card-height-px={timelineContext?.heightPx ?? undefined}
          className={cn(
            JOURNEYS_QUEST_CARD_SHELL_CLASS_NAME,
            "rounded-[22px] px-2",
            isCompactTimelineItem && "h-full min-h-0 rounded-[18px]",
            readableQuestCardsEnabled
              ? JOURNEYS_QUEST_CARD_SHELL_READABLE_CLASS_NAME
              : JOURNEYS_QUEST_CARD_SHELL_STANDARD_TONE_CLASS_NAME,
            isCampaignRitual && (
              readableQuestCardsEnabled
                ? CAMPAIGN_RITUAL_CARD_CLASS_NAME
                : CAMPAIGN_RITUAL_CARD_CLASSES
            ),
            isMobileQuestShellActive && JOURNEYS_QUEST_CARD_SHELL_ACTIVE_CLASS_NAME,
            isMobileQuestShellActive && !readableQuestCardsEnabled && "border-primary/35 bg-primary/[0.06]",
            isComplete && "opacity-70",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3 transition-all relative group",
              "no-text-select select-none",
              isCompactTimelineItem
                ? "h-full min-h-0 gap-2 py-0.5"
                : "min-h-[46px]",
              !isCompactTimelineItem && (isRitual ? "py-3" : "py-2"),
              isDragging && "cursor-grabbing",
            )}
            onContextMenu={suppressNativeContextMenu}
          >
            {/* Checkbox - only this toggles completion */}
            <div className="relative ml-1 flex flex-col items-center self-start pt-0.5 gap-0">
              <button
                data-interactive="true"
                data-tap-control="true"
                onClick={(e) => {
                  if (suppressNextCheckboxClickRef.current) {
                    e.preventDefault();
                    e.stopPropagation();
                    clearTouchCheckboxClickSuppression();
                    return;
                  }
                  handleCheckboxClick(e);
                }}
                onTouchStart={(e) => {
                  touchStartRef.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                  };
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  armTouchCheckboxClickSuppression();
                  // Only trigger if finger moved less than 5px (not scrolling)
                  if (touchStartRef.current) {
                    const dx = Math.abs(e.changedTouches[0].clientX - touchStartRef.current.x);
                    const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.y);
                    if (dx < 5 && dy < 5) {
                      handleCheckboxClick(e as unknown as React.MouseEvent);
                    }
                  }
                  touchStartRef.current = null;
                }}
                className={cn(
                  "relative flex items-center justify-center w-11 h-11 touch-manipulation transition-transform select-none",
                  "active:scale-95"
                )}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                }}
                aria-label={
                  isComplete
                    ? "Mark task as incomplete"
                    : "Mark task as complete"
                }
                role="checkbox"
                aria-checked={isComplete}
              >
                {useLiteAnimations ? (
                  <div
                    className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      isComplete
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40 hover:border-primary"
                    )}
                  >
                    {isComplete && (
                      <Check className="w-4 h-4 text-primary-foreground" />
                    )}
                  </div>
                ) : (
                  <motion.div
                    className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                      isComplete
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40 hover:border-primary"
                    )}
                    whileTap={!isDragging && !isPressed ? { scale: 0.85 } : {}}
                  >
                    {isComplete && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </button>
            </div>

            <div className="grid flex-1 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5">
              <div className="min-w-0" data-testid={`mobile-quest-title-region-${task.id}`}>
                <div
                  className="flex min-w-0 w-full items-center gap-2"
                  data-testid={`mobile-quest-title-row-${task.id}`}
                >
                  {isRitual && (
                    <Repeat className={cn("w-4 h-4 flex-shrink-0", isCampaignRitual ? "text-primary" : "text-accent")} />
                  )}
                  <MarqueeText
                    text={task.task_text}
                    className="min-w-0 w-full flex-1"
                    textClassName={cn(
                      "text-sm",
                      isComplete && "text-muted-foreground",
                      isComplete && (justCompletedTasks.has(task.id) ? "animate-strikethrough" : "line-through")
                    )}
                  />
                </div>
                {isCampaignRitual && !isCompactTimelineItem && (
                  <span className="mt-1 inline-flex max-w-full items-center rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    <span className="truncate">Campaign Ritual - {campaignTitle}</span>
                  </span>
                )}
                {task.scheduled_time && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatTime(task.scheduled_time)}
                  </span>
                )}
                {overlapCount > 0 && !isCompactTimelineItem && (
                  <span className="mt-1 inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Overlaps: {overlapCount}
                  </span>
                )}
              </div>

              <div
                className="flex min-w-max items-center justify-end gap-1.5"
                data-testid={`mobile-quest-actions-${task.id}`}
              >
                {/* Quest action menu */}
                {!isComplete && !isDragging && !isActivated && (onEditQuest || onSendToCalendar || onDeleteQuest || onMoveQuestToNextDay) && (
                  <DropdownMenu
                    open={isActionMenuOpen}
                    onOpenChange={(open) => {
                      setOpenActionMenuTaskId((current) => {
                        if (open) return task.id;
                        return current === task.id ? null : current;
                      });
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        data-interactive="true"
                        data-tap-control="true"
                        aria-label="Quest actions"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 -m-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100 transition-opacity touch-manipulation"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className={cn(COMPANION_FROSTED_PLANNER_DARK_CLASS, "w-44")}
                      data-testid={`quest-action-menu-${task.id}`}
                      style={companionFrostedThemeStyle}
                    >
                      {onEditQuest && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuTaskId(null);
                            onEditQuest(task);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit quest
                        </DropdownMenuItem>
                      )}
                      {onSendToCalendar && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuTaskId(null);
                            onSendToCalendar(task.id);
                          }}
                        >
                          <CalendarPlus className="w-4 h-4 mr-2" />
                          {hasCalendarLink?.(task.id) ? "Re-send to calendar" : "Send to calendar"}
                        </DropdownMenuItem>
                      )}
                      {onMoveQuestToNextDay && !isRitual && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuTaskId(null);
                            onMoveQuestToNextDay(task.id);
                          }}
                        >
                          <CalendarArrowUp className="w-4 h-4 mr-2" />
                          Move to tomorrow
                        </DropdownMenuItem>
                      )}
                      {onDeleteQuest && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuTaskId(null);
                            onDeleteQuest(task.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete quest
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {task.is_main_quest && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 bg-primary/10 border-primary/30">
                    Main
                  </Badge>
                )}
                <span className="text-sm font-bold text-stardust-gold/80">+{effectiveTaskXP}</span>

                {/* Chevron for expandable details - only shown if task has details */}
                {hasDetails && canRenderInlineDetails && (
                  <Button
                    data-interactive="true"
                    data-tap-control="true"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -m-1 flex-shrink-0"
                    onClick={(e) => toggleTaskExpanded(task.id, e)}
                  >
                    <ChevronDown className={cn(
                      "w-4 h-4 text-muted-foreground transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )} />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {canRenderInlineDetails ? (
            <CollapsibleContent>
              <div className="pl-8 pr-2 pb-2 space-y-2">
                {/* Subtasks */}
                {subtasks.length > 0 && (
                  <div className="space-y-1.5 rounded-md border border-border/40 bg-muted/20 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Subtasks
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {completedSubtaskCount}/{subtasks.length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {subtasks.map((subtask) => (
                        <label
                          key={subtask.id}
                          className="flex items-center gap-2 rounded-sm px-1 py-1 text-xs"
                        >
                          <Checkbox
                            checked={!!subtask.completed}
                            onCheckedChange={(checked) => {
                              toggleSubtask.mutate({
                                taskId: task.id,
                                subtaskId: subtask.id,
                                completed: !!checked,
                              });
                            }}
                            onClick={(event) => event.stopPropagation()}
                            className="h-3.5 w-3.5"
                          />
                          <span
                            className={cn(
                              "text-xs",
                              subtask.completed && "text-muted-foreground line-through"
                            )}
                          >
                            {subtask.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {displayAttachments.length > 0 && (
                  <div className="space-y-1.5 rounded-md border border-border/40 bg-muted/20 p-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Attachments
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {displayAttachments.length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {displayAttachments.map((attachment, index) => (
                        <a
                          key={`${attachment.fileUrl}-${index}`}
                          href={attachment.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 rounded-sm px-1 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        >
                          {attachment.isImage ? (
                            <FileImage className="h-3.5 w-3.5 flex-shrink-0" />
                          ) : (
                            <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
                          )}
                          <span className="truncate">{attachment.fileName}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {shouldRenderRitualDescription && (
                  useLiteAnimations ? (
                    <p className="text-sm leading-relaxed whitespace-pre-line text-celestial-blue/80">
                      {stripMarkdown(ritualDescription)}
                    </p>
                  ) : (
                    <motion.p className="text-sm leading-relaxed whitespace-pre-line text-celestial-blue/80">
                      {stripMarkdown(ritualDescription)}
                    </motion.p>
                  )
                )}

                {/* Notes */}
                {shouldRenderNotes && (
                  useLiteAnimations ? (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed whitespace-pre-line">{stripMarkdown(task.notes)}</p>
                    </div>
                  ) : (
                    <motion.div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <p className="text-xs leading-relaxed whitespace-pre-line">{stripMarkdown(task.notes)}</p>
                    </motion.div>
                  )
                )}

                {task.location ? (
                  <QuestLocationLink
                    location={task.location}
                    label="Address"
                    className="rounded-md border-border/40 bg-muted/20 p-2"
                    textClassName="text-xs text-muted-foreground"
                    actionsClassName="mt-2"
                  />
                ) : null}

                {/* Badges row */}
                {hasDetailBadges && (
                  <div className="flex flex-wrap gap-1.5">
                  {/* Category */}
                  {CategoryIcon && task.category && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 border-muted-foreground/30">
                      <CategoryIcon className="w-3 h-3" />
                      {task.category}
                    </Badge>
                  )}

                  {/* Difficulty */}
                  {task.difficulty && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-1.5 py-0.5 h-5",
                        task.difficulty === 'easy' && "bg-green-500/10 text-green-500 border-green-500/30",
                        task.difficulty === 'medium' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                        task.difficulty === 'hard' && "bg-red-500/10 text-red-500 border-red-500/30"
                      )}
                    >
                      {task.difficulty}
                    </Badge>
                  )}

                  {/* Priority */}
                  {task.priority && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-1.5 py-0.5 h-5",
                        task.priority === 'high' && "bg-red-500/10 text-red-500 border-red-500/30",
                        task.priority === 'medium' && "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
                        task.priority === 'low' && "bg-blue-500/10 text-blue-500 border-blue-500/30"
                      )}
                    >
                      {task.priority} priority
                    </Badge>
                  )}

                  {/* Duration */}
                  {task.estimated_duration && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 border-muted-foreground/30">
                      <Timer className="w-3 h-3" />
                      {task.estimated_duration}m
                    </Badge>
                  )}

                  {/* Recurrence */}
                  {task.is_recurring && task.recurrence_pattern && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 bg-accent/10 text-accent border-accent/30">
                      <Repeat className="w-3 h-3" />
                      {formatDisplayLabel(task.recurrence_pattern)}
                    </Badge>
                  )}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          ) : null}
        </div>
      </Collapsible>
    );

    return taskContent;
  }, [
    onToggle,
    onUndoToggle,
    onEditQuest,
    onSendToCalendar,
    hasCalendarLink,
    onDeleteQuest,
    onMoveQuestToNextDay,
    expandedTasks,
    hasExpandableDetails,
    habitDescriptionById,
    toggleTaskExpanded,
    justCompletedTasks,
    optimisticCompleted,
    toggleSubtask,
    useLiteAnimations,
    registerCompletionCombo,
    resetCombo,
    armTouchCheckboxClickSuppression,
    clearTouchCheckboxClickSuppression,
    suppressNativeContextMenu,
    openActionMenuTaskId,
    isDesktopLayout,
    openDesktopDetailTaskId,
    scheduleDesktopTaskSingleClick,
    handleDesktopTaskDoubleClick,
  ]);

  const desktopRailCardClass = "journeys-desktop-rail-card rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,20,38,0.94),rgba(16,13,27,0.9))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)]";
  const desktopRail = isDesktopLayout ? (
    <aside className="flex flex-col gap-4">
      <section className={desktopRailCardClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
              Selected Day
            </p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {selectedDateHeading}
              </h2>
              {isSelectedToday ? (
                <span className="rounded-full bg-celestial-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-celestial-blue">
                  Today
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedDateSubheading}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-2">
            <div className="flex items-center gap-3">
              <ProgressRing percent={progressPercent} size={40} strokeWidth={3.5} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">
                  Progress
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {completedCount}/{totalCount || 0} done
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Open</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedOpenCount}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Timed</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedScheduledCount}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Anytime</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedAnytimeCount}</p>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Rituals</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedRitualCount}</p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/75">
            Next Focus
          </p>
          {nextFocusTask ? (
            <>
              <p className="mt-2 text-sm font-semibold text-foreground">{nextFocusTask.task_text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {nextFocusTask.scheduled_time ? formatTime(nextFocusTask.scheduled_time) : "No time locked yet"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing is queued yet for this day.
            </p>
          )}
          {!hideDesktopRailAddButton && !isDesktopLayout ? (
            <div className="mt-4">
              <JourneysCompanionLauncher
                variant="inline"
                data-tour="add-quest-launcher"
                text={planDayLauncherLabel}
                className="w-full"
                onClick={plannerLauncherAction}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className={desktopRailCardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
              This Week
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {weekCompletedCount}/{weekTotalCount || 0}
            </p>
            <p className="text-sm text-muted-foreground">
              quests completed across {weekActiveDays || 0} active day{weekActiveDays === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">
              XP banked
            </p>
            <p className="mt-2 text-xl font-semibold text-stardust-gold">{weekXP}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Active</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{weekActiveDays}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Timed</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{weekScheduledCount}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">Streak</p>
            <p className="mt-2 text-xl font-semibold text-foreground">{currentStreak}</p>
          </div>
        </div>

        <div className="mt-4 h-2 rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-primary/85"
            style={{ width: `${weekTotalCount > 0 ? (weekCompletedCount / weekTotalCount) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {weekTotalCount > 0
            ? "Desktop now keeps the day plan anchored while the week stays visible above."
            : "This week is still open. Add your first quest to start shaping it."}
        </p>
      </section>

      <section className={desktopRailCardClass}>
        {campaignRitualGroups.length > 0 || activeEpics.length > 0 || isCampaignsLoading ? (
          renderCampaignSection({ inDesktopRail: true })
        ) : (
          <>
            {renderCampaignSectionLabel("Campaigns")}
            <p className="mt-3 text-sm text-muted-foreground">
              No campaigns or rituals are attached to this day yet.
            </p>
          </>
        )}
      </section>
    </aside>
  ) : null;

  const scheduledPaneStyle: CSSProperties | undefined = timelineBodyHeightPx
    ? isDesktopLayout
      ? { height: `${timelineBodyHeightPx}px` }
      : {
          maxHeight: `${timelineBodyHeightPx}px`,
          scrollPaddingBottom: mobileFabScrollClearance,
        }
    : !isDesktopLayout
      ? { scrollPaddingBottom: mobileFabScrollClearance }
      : undefined;

  const scheduledTimelineContentStyle: CSSProperties | undefined = isDesktopLayout
    ? undefined
    : { paddingBottom: mobileFabScrollClearance };

  return (
    <div
      className={cn(
        COMPANION_FROSTED_PLANNER_DARK_CLASS,
        "relative",
        isDesktopLayout && "grid grid-cols-[minmax(0,1fr)_340px] items-start gap-6",
      )}
      data-testid="todays-agenda"
      style={companionFrostedThemeStyle}
    >
      <div
        className={cn(
          "relative px-2 py-2 overflow-visible",
          isDesktopLayout && "journeys-desktop-shell flex min-h-0 flex-col rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(24,21,39,0.95),rgba(13,11,23,0.92))] px-5 py-5 shadow-[0_28px_54px_rgba(0,0,0,0.24)]",
        )}
      >
        {/* Compact Header: Date + Progress Ring + XP */}
        <div className={cn("mb-3 flex items-center justify-between gap-3", isDesktopLayout && "mb-5")}>
          <div className={cn("flex items-center gap-2", isDesktopLayout && "gap-3")}>
            <button
              type="button"
              onClick={() => onOpenMonthView?.()}
              className="flex items-center gap-1.5 rounded-2xl transition-opacity hover:opacity-80"
            >
              <span className={cn("text-lg font-bold", isDesktopLayout && "text-[1.8rem] tracking-tight")}>
                {safeFormat(selectedDate, "MMM d, yyyy", "Invalid date")}
              </span>
            </button>
            {currentStreak > 0 && (
              <div className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                currentStreak >= 30
                  ? "bg-stardust-gold/20 text-stardust-gold"
                  : currentStreak >= 14
                    ? "bg-celestial-blue/20 text-celestial-blue"
                    : "bg-orange-500/10 text-orange-400"
              )}>
                <Flame className="h-3.5 w-3.5" />
                {currentStreak}
              </div>
            )}
          </div>

          <div className={cn("flex items-center gap-2", isDesktopLayout && "gap-3")}>
            {/* Compact progress ring */}
            {totalCount > 0 && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5",
                  isDesktopLayout && "px-3 py-2",
                )}
              >
                <ProgressRing percent={progressPercent} size={24} strokeWidth={2.5} />
                <span className="text-xs font-medium text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              </div>
            )}
            <div
              className={cn(
                "flex items-center gap-1 rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-sm",
                isDesktopLayout && "px-3 py-2",
              )}
            >
              <Trophy className={cn(
                "h-4 w-4",
                allComplete ? "text-stardust-gold" : "text-stardust-gold/70"
              )} />
              <span className="font-semibold text-stardust-gold">{totalXP}</span>
            </div>
            {quickCaptureControls}
          </div>
        </div>

        {isDesktopLayout ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {onDesktopPlannerModeChange ? (
              <div
                className="flex items-center gap-1 rounded-[18px] border border-white/10 bg-white/5 p-1"
                role="group"
                aria-label="Desktop planner mode"
              >
                <Button
                  type="button"
                  variant={desktopPlannerMode === "week" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 rounded-[14px] px-3 text-xs",
                    desktopPlannerMode === "week"
                      ? "bg-white/12 text-white hover:bg-white/15"
                      : "text-muted-foreground hover:bg-white/8 hover:text-foreground",
                  )}
                  aria-pressed={desktopPlannerMode === "week"}
                  onClick={() => onDesktopPlannerModeChange("week")}
                >
                  Week
                </Button>
                <Button
                  type="button"
                  variant={desktopPlannerMode === "day" ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 rounded-[14px] px-3 text-xs",
                    desktopPlannerMode === "day"
                      ? "bg-white/12 text-white hover:bg-white/15"
                      : "text-muted-foreground hover:bg-white/8 hover:text-foreground",
                  )}
                  aria-pressed={desktopPlannerMode === "day"}
                  onClick={() => onDesktopPlannerModeChange("day")}
                >
                  Day
                </Button>
              </div>
            ) : <div />}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {onDateSelect ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-[18px] border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => onDateSelect(addDays(selectedDate, -1))}
                    aria-label="Previous day"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-[18px] border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
                    onClick={() => onDateSelect(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-[18px] border-white/10 bg-white/5 hover:bg-white/10"
                    onClick={() => onDateSelect(addDays(selectedDate, 1))}
                    aria-label="Next day"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
              {onOpenMonthView ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-[18px] border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10"
                  onClick={() => onOpenMonthView()}
                >
                  <CalendarDays className="h-4 w-4" />
                  Month
                </Button>
              ) : null}
              {showCompanionPlannerHeaderAction && onOpenCompanionPlanner ? (
                <JourneysCompanionLauncher
                  variant="inline"
                  compact
                  data-tour="add-quest-launcher"
                  text={planDayLauncherLabel}
                  className="shadow-[0_14px_28px_rgba(122,61,255,0.2)]"
                  onClick={openPlanDayThread}
                />
              ) : null}
              {quickCaptureControls}
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {comboCount > 1 && (
            <motion.div
              key="combo-banner"
              initial={useLiteAnimations ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={useLiteAnimations ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: useLiteAnimations ? 0.1 : 0.24 }}
              className={cn(
                "mb-3 relative overflow-hidden rounded-xl border px-3 py-2",
                "bg-gradient-to-r from-stardust-gold/12 via-primary/10 to-stardust-gold/12 border-stardust-gold/30",
                showComboFx && !useLiteAnimations && "animate-combo-pop",
              )}
              data-testid="combo-banner"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-stardust-gold" />
                  <span className="text-sm font-semibold text-stardust-gold">
                    Combo x{comboCount}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Keep completing quests
                </span>
              </div>

              {!useLiteAnimations && showComboFx && (
                <div className="pointer-events-none absolute inset-0">
                  <span className="absolute left-4 top-2 h-1.5 w-1.5 rounded-full bg-stardust-gold animate-combo-particle" />
                  <span className="absolute left-1/2 top-1 h-1 w-1 rounded-full bg-primary animate-combo-particle [animation-delay:120ms]" />
                  <span className="absolute right-5 bottom-2 h-1.5 w-1.5 rounded-full bg-celestial-blue animate-combo-particle [animation-delay:200ms]" />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline Content */}
        <div className={cn(isDesktopLayout && "flex min-h-0 flex-1 flex-col")}>
          <div className={cn("mb-2 flex flex-wrap items-center justify-between gap-2", isDesktopLayout && "mb-3")}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {tasks.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      aria-label="Sort tasks"
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[14px] border border-white/8 bg-white/[0.03] opacity-60 transition-opacity hover:opacity-90"
                    >
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(COMPANION_FROSTED_PLANNER_DARK_CLASS, "w-28")}
                    data-testid="quest-sort-menu"
                    style={companionFrostedThemeStyle}
                  >
                    <DropdownMenuItem
                      onClick={() => setSortBy('custom')}
                      className={cn("text-xs", sortBy === 'custom' && 'bg-accent/10')}
                    >
                      Custom
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortBy('time')}
                      className={cn("text-xs", sortBy === 'time' && 'bg-accent/10')}
                    >
                      Time
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortBy('priority')}
                      className={cn("text-xs", sortBy === 'priority' && 'bg-accent/10')}
                    >
                      Priority
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setSortBy('xp')}
                      className={cn("text-xs", sortBy === 'xp' && 'bg-accent/10')}
                    >
                      XP
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {anytimeItems.length > 0 ? (
                <Drawer
                  open={untimedDrawerOpen}
                  onOpenChange={setUntimedDrawerOpen}
                  shouldScaleBackground={false}
                >
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-[16px] border-white/10 bg-white/[0.04] px-2.5 text-xs hover:bg-white/[0.08]"
                      data-testid="untimed-quests-drawer-trigger"
                    >
                      <Inbox className="h-3.5 w-3.5" />
                      Untimed
                      <Badge variant="secondary" className="h-5 rounded-full px-1.5 text-[10px]">
                        {anytimeItems.length}
                      </Badge>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent
                    className={COMPANION_FROSTED_PLANNER_DARK_CLASS}
                    data-testid="untimed-quests-drawer"
                    style={companionFrostedThemeStyle}
                  >
                    <DrawerHeader>
                      <DrawerTitle>Untimed quests</DrawerTitle>
                      <DrawerDescription>
                        {anytimeItems.length} quest{anytimeItems.length === 1 ? "" : "s"} waiting for a time.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div
                      className="overflow-y-auto px-4 pb-6"
                      data-testid="untimed-quests-list"
                    >
                      <div className="space-y-2">
                        {anytimeItems.map((task) => (
                          <div
                            key={task.id}
                            className={cn("min-h-[58px]", isDesktopLayout && "rounded-[18px]")}
                            data-testid={`untimed-quest-${task.id}`}
                          >
                            {renderTaskItem(task, undefined, 0)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : null}
            </div>
          </div>

          {tasks.length === 0 ? (
            <div
              className={cn(
                "mb-3 rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-8 text-center",
                isDesktopLayout && "px-8",
              )}
              style={isDesktopLayout && timelineBodyHeightPx ? { minHeight: `${timelineBodyHeightPx}px` } : undefined}
              data-testid="empty-state-pane"
            >
              <Circle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="mb-2 text-sm font-medium text-foreground">
                No tasks for this day
              </p>
              <p className={cn("mx-auto max-w-sm text-xs text-muted-foreground/70", isDesktopLayout && "text-sm")}>
                {isSelectedToday
                  ? "Your day is still open. Add a quest to give the planner some shape."
                  : `Nothing is planned for ${selectedDateHeading} yet. Add a quest to anchor the day.`}
              </p>
              <div className="mt-4 flex items-center justify-center">
                <JourneysCompanionLauncher
                  variant="inline"
                  data-tour="add-quest-launcher"
                  caption="New quest"
                  text="Add Quest"
                  className="w-full max-w-xs justify-center"
                  onClick={openQuestCaptureThread}
                />
              </div>
            </div>
          ) : null}

          <div className={cn(isDesktopLayout && "flex min-h-0 flex-1 flex-col")}>
            <div
              ref={setScheduledPaneNode}
              className={cn(
                "overflow-y-auto overflow-x-hidden overscroll-contain pr-1",
                isDesktopLayout && "min-h-0",
              )}
              style={scheduledPaneStyle}
              data-testid="scheduled-timeline-pane"
            >
              <div
                data-testid="scheduled-timeline-content"
                style={scheduledTimelineContentStyle}
              >
                <div
                  className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/10"
                  data-testid="journeys-day-grid"
                  style={{ height: `${OUTLOOK_TIMELINE_HEIGHT_PX}px` }}
                >
                  {fullDaySlotMinutes.map((slotMinute) => {
                    const isHour = slotMinute % 60 === 0;
                    const slotToken = minuteToMarkerToken(slotMinute);
                    return (
                      <div
                        key={slotMinute}
                        className={cn(
                          "absolute left-0 right-0 flex border-b border-white/[0.07]",
                          isHour ? "border-t border-white/[0.10]" : "border-t border-dashed border-white/[0.06]",
                          onTimeSlotLongPress && "touch-manipulation",
                        )}
                        data-testid={`journeys-day-grid-slot-${slotToken}`}
                        data-minute={slotMinute}
                        style={{
                          top: `${getTimelineTopPx(slotMinute)}px`,
                          height: `${OUTLOOK_TIMELINE_SLOT_HEIGHT_PX}px`,
                        }}
                        onTouchStart={(event) => handleTimeSlotTouchStart(slotMinute, event)}
                        onTouchMove={handleTimeSlotTouchMove}
                        onTouchEnd={clearTimeSlotLongPress}
                        onTouchCancel={clearTimeSlotLongPress}
                      >
                        <div
                          className="flex-shrink-0 px-1.5 pt-1.5 text-right text-[10px] font-medium text-muted-foreground/80"
                          style={{ width: `${OUTLOOK_TIMELINE_GUTTER_WIDTH_PX}px` }}
                        >
                          {isHour ? formatGridTimeLabel(slotMinute) : null}
                        </div>
                        <div className="min-w-0 flex-1" />
                      </div>
                    );
                  })}

                  {isTodaySelected ? (
                    <div
                      ref={nowMarkerRowRef}
                      className="pointer-events-none absolute left-0 right-0 z-30 flex -translate-y-1/2 items-center"
                      data-testid="timeline-marker-now"
                      data-minute={nowMarkerMinute}
                      style={{ top: `${getTimelineTopPx(nowMarkerMinute)}px` }}
                    >
                      <div
                        className="pr-1 text-right text-[10px] font-semibold text-stardust-gold"
                        style={{ width: `${OUTLOOK_TIMELINE_GUTTER_WIDTH_PX}px` }}
                      >
                        <span aria-hidden="true">{formatCurrentTimeLabel(nowMarkerMinute)}</span>
                        <span className="sr-only" data-testid="timeline-row-time">
                          {minuteToTime(nowMarkerMinute)}
                        </span>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-stardust-gold shadow-[0_0_10px_hsl(var(--stardust-gold)/0.7)]" />
                      <div className="h-px flex-1 bg-stardust-gold/80" />
                    </div>
                  ) : null}

                  <div
                    className="pointer-events-none absolute bottom-0 right-0 top-0 z-10"
                    style={{ left: `${OUTLOOK_TIMELINE_GUTTER_WIDTH_PX}px` }}
                  >
                    {positionedTimelineTasks.map((entry) => {
                      const task = entry.task;
                      const isThisDragging = timelineDraggingTaskId === task.id;
                      const isThisLongPressed = timelineLongPressTaskId === task.id;
                      const isThisEngaged = isThisDragging || isThisLongPressed;
                      const isAnyDragging = timelineIsDragging;
                      const isJustDropped = timelineJustDroppedId === task.id;
                      const usesOverlayPlaceholder = isThisDragging && shouldRenderDragOverlay;
                      const laneOffsetPx = entry.laneIndex > 0 ? OUTLOOK_TIMELINE_EVENT_GAP_PX : 0;
                      const baseTimelineRowDragProps = isDesktopTimelineDragEnabled && task.scheduled_time && !task.completed
                        ? timelineDrag.getRowDragProps(task.id, task.scheduled_time)
                        : undefined;
                      const timelineRowDragProps = baseTimelineRowDragProps
                        ? {
                            // Keep touch hold-to-reschedule, but skip pointer row drag so
                            // clicks/trackpad drags do not hijack normal quest interactions.
                            onTouchStartCapture: (
                              event: Parameters<NonNullable<typeof baseTimelineRowDragProps.onTouchStartCapture>>[0],
                            ) => {
                              seedDragOverlaySnapshotForTask(task.id);
                              baseTimelineRowDragProps.onTouchStartCapture?.(event);
                            },
                            onTouchStart: baseTimelineRowDragProps.onTouchStart,
                            onTouchMove: baseTimelineRowDragProps.onTouchMove,
                            onTouchEnd: baseTimelineRowDragProps.onTouchEnd,
                            onTouchCancel: baseTimelineRowDragProps.onTouchCancel,
                          }
                        : undefined;
                      const overlapCount = timelineConflictMap.get(task.id)?.size ?? 0;
                      const isCompactTimelineRow = !isDesktopLayout && entry.heightPx <= COMPACT_TIMELINE_ROW_MAX_HEIGHT_PX;

                      const rowStyle: CSSProperties = {
                        WebkitUserSelect: "none",
                        userSelect: "none",
                        WebkitTouchCallout: "none",
                        touchAction: isThisEngaged ? "none" : "pan-y",
                        pointerEvents: isAnyDragging && !isThisDragging ? "none" : "auto",
                        opacity: usesOverlayPlaceholder ? 0 : isAnyDragging && !isThisDragging ? 0.7 : 1,
                        boxShadow: isThisEngaged && !usesOverlayPlaceholder
                          ? "0 15px 30px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -4px rgba(0, 0, 0, 0.15)"
                          : "none",
                        backgroundColor: isThisEngaged && !usesOverlayPlaceholder ? "hsl(var(--background))" : "transparent",
                        borderRadius: isThisEngaged && !usesOverlayPlaceholder ? 12 : 0,
                        transition: "none",
                        willChange: isThisDragging && !usesOverlayPlaceholder ? "transform" : undefined,
                      };
                      const bounceAnimation = !useLiteAnimations && isJustDropped && !isThisDragging
                        ? {
                            scale: [1, 1.02, 0.98, 1],
                            y: [0, -2, 1, 0],
                          }
                        : undefined;

                      return (
                        <motion.div
                          ref={(node) => {
                            if (node) {
                              timelineRowRefs.current.set(task.id, node);
                            } else {
                              timelineRowRefs.current.delete(task.id);
                            }
                          }}
                          key={task.id}
                          className={cn(
                            "absolute no-text-select",
                            isThisEngaged && !usesOverlayPlaceholder && "z-50",
                          )}
                          layout={!isThisDragging || usesOverlayPlaceholder}
                          animate={bounceAnimation}
                          transition={bounceAnimation ? {
                            duration: 0.25,
                            ease: [0.25, 0.1, 0.25, 1],
                            layout: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 },
                          } : {
                            layout: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 },
                          }}
                          data-timeline-lane={entry.laneIndex}
                          data-timeline-lane-count={entry.laneCount}
                          data-timeline-overlap={entry.overlapCount}
                          data-timeline-shift-px={laneOffsetPx}
                          data-start-minute={entry.startMinute}
                          data-top-px={entry.topPx}
                          data-duration-height-px={entry.heightPx}
                          onContextMenu={suppressNativeContextMenu}
                          {...(timelineRowDragProps ?? {})}
                          style={{
                            ...rowStyle,
                            top: `${entry.topPx}px`,
                            left: `calc(${entry.leftPercent}% + ${OUTLOOK_TIMELINE_EVENT_GAP_PX}px)`,
                            width: `calc(${entry.widthPercent}% - ${OUTLOOK_TIMELINE_EVENT_GAP_PX * 2}px)`,
                            height: `${entry.heightPx}px`,
                            maxWidth: laneOffsetPx > 0 ? `calc(100% - ${laneOffsetPx}px)` : undefined,
                            y: isThisDragging && !usesOverlayPlaceholder ? dragVisualOffsetY : 0,
                          }}
                        >
                          <div
                            className={cn("h-full min-w-0", isCompactTimelineRow && "overflow-hidden")}
                            data-testid={`timeline-row-${task.id}`}
                            data-timeline-lane={entry.laneIndex}
                            data-timeline-lane-count={entry.laneCount}
                            data-timeline-overlap={entry.overlapCount}
                            data-timeline-compact={isCompactTimelineRow ? "true" : undefined}
                            data-start-minute={entry.startMinute}
                            data-top-px={entry.topPx}
                            data-duration-minutes={task.estimated_duration ?? undefined}
                            data-duration-height-px={entry.heightPx}
                            style={{
                              overflow: isCompactTimelineRow ? "hidden" : undefined,
                              minHeight: desktopTimelineDurationLayout
                                ? `${durationMinutesToPixels(task.estimated_duration, desktopTimelineDurationLayout)}px`
                                : undefined,
                            }}
                          >
                            <span className="sr-only" data-testid="timeline-row-time">
                              {isThisDragging ? timelinePreviewTime ?? task.scheduled_time : task.scheduled_time}
                            </span>
                            {renderTaskItem(task, undefined, overlapCount, {
                              isScheduledTimeline: true,
                              heightPx: entry.heightPx,
                              isCompact: isCompactTimelineRow,
                            })}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                {!isDesktopLayout ? renderCampaignSection() : null}
              </div>
            </div>
          </div>
        </div>

        {/* Inbox section removed - now has its own tab */}
      </div>

      {desktopRail}

      {shouldRenderDragOverlay && draggedScheduledTask && dragOverlaySnapshot && typeof document !== "undefined"
        ? createPortal(
            <motion.div
              data-testid="timeline-drag-overlay"
              className="pointer-events-none fixed z-[120] rounded-xl bg-background shadow-[0_18px_32px_-10px_rgba(0,0,0,0.35),0_10px_16px_-8px_rgba(0,0,0,0.2)]"
              style={{
                top: dragOverlaySnapshot.top,
                left: dragOverlaySnapshot.left,
                width: dragOverlaySnapshot.width,
                x: draggedLaneOffsetPx,
                y: dragOverlayOffsetY,
              }}
            >
              <TimelineTaskRow
                rowKind="task"
                time={draggedScheduledTask.scheduled_time}
                overrideTime={timelinePreviewTime ?? undefined}
                isDragTarget
                durationMinutes={draggedScheduledTask.estimated_duration}
                durationLayout={desktopTimelineDurationLayout}
                laneIndex={draggedScheduledFlow?.laneIndex}
                laneCount={draggedScheduledFlow?.laneCount}
                overlapCount={draggedScheduledFlow?.overlapCount}
                className="cursor-grabbing"
                data-testid={`timeline-drag-overlay-row-${draggedScheduledTask.id}`}
              >
                {renderTaskItem(draggedScheduledTask, undefined, draggedOverlapCount)}
              </TimelineTaskRow>
            </motion.div>,
            document.body,
          )
        : null}

      {timelineZoomRail ? <DragTimeZoomRail rail={timelineZoomRail} /> : null}
    </div>
  );
});
