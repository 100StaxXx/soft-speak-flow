import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback, memo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTimelineDrag } from "@/hooks/useTimelineDrag";
import { format, differenceInDays, isSameDay } from "date-fns";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { toast } from "sonner";
import { 
  Flame, 
  Trophy, 
  Plus,
  Check,
  Circle,
  Clock,
  Pencil,
  Repeat,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  FileText,
  Timer,
  Brain,
  Heart,
  Dumbbell,
  ArrowUpDown,
  MoreHorizontal,
  CalendarPlus,
  CalendarArrowUp,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HourlyViewModal } from "@/components/HourlyViewModal";
import { DragTimeZoomRail } from "@/components/calendar/DragTimeZoomRail";
import { CalendarTask, CalendarMilestone } from "@/types/quest";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn, stripMarkdown } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { MAIN_QUEST_XP_MULTIPLIER } from "@/config/xpRewards";

import { useProfile } from "@/hooks/useProfile";
import { playStrikethrough } from "@/utils/soundEffects";

import { type DragHandleProps } from "./DraggableTaskList";
import { MarqueeText } from "@/components/ui/marquee-text";
import { JourneyPathDrawer } from "@/components/JourneyPathDrawer";
import { TimelineTaskRow } from "@/components/TimelineTaskRow";
import { ProgressRing } from "@/features/tasks/components/ProgressRing";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { buildTaskConflictMap, getTaskConflictSetForTask } from "@/utils/taskTimeConflicts";
import { buildTaskTimelineFlow } from "@/utils/taskTimelineFlow";
import { SHARED_TIMELINE_DRAG_PROFILE } from "@/components/calendar/dragSnap";

// Helper to calculate days remaining
const getDaysLeft = (endDate?: string | null) => {
  if (!endDate) return null;
  try {
    const parsed = new Date(endDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.max(0, differenceInDays(parsed, new Date()));
  } catch {
    return null;
  }
};

const safeFormat = (date: Date, fmt: string, fallback = "") => {
  try {
    if (Number.isNaN(date.getTime())) return fallback;
    return format(date, fmt);
  } catch {
    return fallback;
  }
};

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
  energy_level?: string | null;
  estimated_duration?: number | null;
  is_recurring?: boolean | null;
  recurrence_pattern?: string | null;
  recurrence_days?: number[] | null;
  reminder_enabled?: boolean | null;
  reminder_minutes_before?: number | null;
  category?: string | null;
  image_url?: string | null;
  subtasks?: TaskSubtask[];
}

interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean | null;
  sort_order: number | null;
}

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
  isVisible?: boolean;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onAddQuest: () => void;
  completedCount: number;
  totalCount: number;
  currentStreak?: number;
  onUndoToggle?: (taskId: string, xpReward: number) => void;
  onEditQuest?: (task: Task) => void;
  calendarTasks?: CalendarTask[];
  calendarMilestones?: CalendarMilestone[];
  onDateSelect?: (date: Date) => void;
  activeEpics?: Array<{
    id: string;
    title: string;
    description?: string | null;
    progress_percentage?: number | null;
    target_days: number;
    start_date: string;
    end_date: string;
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
  onDeleteQuest?: (taskId: string) => void;
  onMoveQuestToNextDay?: (taskId: string) => void;
  onUpdateScheduledTime?: (taskId: string, newTime: string) => void;
  onTimeSlotLongPress?: (date: Date, time: string) => void;
  onSendToCalendar?: (taskId: string) => void;
  hasCalendarLink?: (taskId: string) => boolean;
  onTimelineDragPreviewTimeChange?: (time: string | null) => void;
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
const DEFAULT_DAY_START_MINUTE = 6 * 60;
const DAY_END_MINUTE = (24 * 60) - 1;
const PLACEHOLDER_INTERVAL_MINUTES = 3 * 60;
const MIN_PLACEHOLDER_EMPHASIS = 0.2;
const MAX_PLACEHOLDER_EMPHASIS = 1;
const LANE_OFFSET_STEP_PX = 10;
const NOW_MARKER_VIEWPORT_TARGET = 0.45;
const DEFAULT_BOTTOM_NAV_SAFE_OFFSET_PX = 104;
const DRAG_OVERLAY_TOP_PADDING_PX = 8;
const DRAG_OVERLAY_BOTTOM_PADDING_PX = 10;
const DRAG_OVERLAY_NAV_GAP_PX = 4;
const EDGE_HOLD_ACTIVATION_MS = 160;
const EDGE_HOLD_PIN_THRESHOLD_PX = 0.5;
const EDGE_HOLD_NEAR_MAX_OVERSHOOT_PX = 24;
const EDGE_HOLD_MEDIUM_MAX_OVERSHOOT_PX = 72;
const EDGE_HOLD_HIGH_MAX_OVERSHOOT_PX = 140;
const EDGE_HOLD_NEAR_REPEAT_MS = 150;
const EDGE_HOLD_MEDIUM_REPEAT_MS = 105;
const EDGE_HOLD_HIGH_REPEAT_MS = 60;
const EDGE_HOLD_EXTREME_REPEAT_MS = 45;
const EDGE_HOLD_NEAR_STEP_MULTIPLIER = 1;
const EDGE_HOLD_MEDIUM_STEP_MULTIPLIER = 2;
const EDGE_HOLD_HIGH_STEP_MULTIPLIER = 3;
const EDGE_HOLD_EXTREME_STEP_MULTIPLIER = 4;

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

const getBottomNavSafeOffsetPx = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_BOTTOM_NAV_SAFE_OFFSET_PX;
  }

  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.top = "0";
  probe.style.left = "0";
  probe.style.height = "var(--bottom-nav-safe-offset)";
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

interface TimelineMarkerRow {
  id: string;
  minute: number;
  time: string;
  kind: "placeholder" | "now";
  emphasis: number;
}

type TimelineRow =
  | { kind: "marker"; marker: TimelineMarkerRow }
  | { kind: "task"; task: Task };

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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const normalizeModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

const getLaneOffsetPx = (laneIndex: number, overlapCount: number) => {
  return overlapCount > 0 ? laneIndex * LANE_OFFSET_STEP_PX : 0;
};

const getHourlyPlaceholderCandidatesBetween = (
  startMinute: number,
  endMinute: number,
): number[] => {
  if (endMinute - startMinute <= 1) return [];

  const firstCandidateMinute = Math.ceil((startMinute + 1) / 60) * 60;
  const candidates: number[] = [];

  for (let minute = firstCandidateMinute; minute < endMinute; minute += 60) {
    if (minute <= DAY_END_MINUTE) {
      candidates.push(minute);
    }
  }

  return candidates;
};

const pickClosestMinuteToMidpoint = (candidates: number[], midpoint: number): number | null => {
  if (candidates.length === 0) return null;

  let bestMinute = candidates[0];
  let bestDistance = Math.abs(bestMinute - midpoint);

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const candidateDistance = Math.abs(candidate - midpoint);
    if (candidateDistance < bestDistance) {
      bestMinute = candidate;
      bestDistance = candidateDistance;
      continue;
    }
    if (candidateDistance === bestDistance && candidate < bestMinute) {
      bestMinute = candidate;
    }
  }

  return bestMinute;
};

const selectPairPlaceholderMinute = (
  startMinute: number,
  endMinute: number,
): number | null => {
  const gapMinutes = endMinute - startMinute;
  if (gapMinutes < 60) return null;

  const midpoint = (startMinute + endMinute) / 2;
  const candidates = getHourlyPlaceholderCandidatesBetween(startMinute, endMinute);

  return pickClosestMinuteToMidpoint(candidates, midpoint);
};

const isStrictlyBetweenConsecutiveQuestTimes = (
  minute: number,
  sortedScheduledMinutes: number[],
): boolean => {
  for (let index = 1; index < sortedScheduledMinutes.length; index += 1) {
    const previousMinute = sortedScheduledMinutes[index - 1];
    const nextMinute = sortedScheduledMinutes[index];
    if (previousMinute < minute && minute < nextMinute) {
      return true;
    }
  }
  return false;
};

const buildPlaceholderMinutes = (
  scheduledMinutes: number[],
  dayStartMinute: number,
): number[] => {
  const sortedScheduledMinutes = [...scheduledMinutes].sort((a, b) => a - b);
  const markerMinutes = new Set<number>([dayStartMinute]);

  if (sortedScheduledMinutes.length === 0) {
    return Array.from(markerMinutes).sort((a, b) => a - b);
  }

  for (const scheduledMinute of sortedScheduledMinutes) {
    const remainder = normalizeModulo(scheduledMinute, PLACEHOLDER_INTERVAL_MINUTES);
    const isOnBoundary = remainder === 0;

    const lowerAnchor = isOnBoundary
      ? scheduledMinute - PLACEHOLDER_INTERVAL_MINUTES
      : scheduledMinute - remainder;
    const upperAnchor = isOnBoundary
      ? scheduledMinute + PLACEHOLDER_INTERVAL_MINUTES
      : lowerAnchor + PLACEHOLDER_INTERVAL_MINUTES;

    if (lowerAnchor >= 0 && lowerAnchor <= DAY_END_MINUTE) markerMinutes.add(lowerAnchor);
    if (upperAnchor >= 0 && upperAnchor <= DAY_END_MINUTE) markerMinutes.add(upperAnchor);
  }

  if (sortedScheduledMinutes.length > 1) {
    for (const minute of Array.from(markerMinutes)) {
      if (minute === dayStartMinute) continue;
      if (isStrictlyBetweenConsecutiveQuestTimes(minute, sortedScheduledMinutes)) {
        markerMinutes.delete(minute);
      }
    }

    for (let index = 1; index < sortedScheduledMinutes.length; index += 1) {
      const previousMinute = sortedScheduledMinutes[index - 1];
      const nextMinute = sortedScheduledMinutes[index];
      const selectedMinute = selectPairPlaceholderMinute(previousMinute, nextMinute);
      if (selectedMinute !== null) {
        markerMinutes.add(selectedMinute);
      }
    }
  }

  return Array.from(markerMinutes).sort((a, b) => a - b);
};

const pruneMarkersBetweenConsecutiveQuests = (
  markers: Map<number, TimelineMarkerRow>,
  sortedScheduledMinutes: number[],
): Map<number, TimelineMarkerRow> => {
  if (sortedScheduledMinutes.length < 2) {
    return markers;
  }

  for (let index = 1; index < sortedScheduledMinutes.length; index += 1) {
    const previousMinute = sortedScheduledMinutes[index - 1];
    const nextMinute = sortedScheduledMinutes[index];
    const betweenMarkers = Array.from(markers.values())
      .filter((marker) => previousMinute < marker.minute && marker.minute < nextMinute)
      .sort((a, b) => a.minute - b.minute);

    if (betweenMarkers.length <= 1) continue;

    const nowMarker = betweenMarkers.find((marker) => marker.kind === "now");
    if (nowMarker) {
      for (const marker of betweenMarkers) {
        if (marker.kind === "placeholder") {
          markers.delete(marker.minute);
        }
      }
      continue;
    }

    const keepMinute = pickClosestMinuteToMidpoint(
      betweenMarkers
        .filter((marker) => marker.kind === "placeholder")
        .map((marker) => marker.minute),
      (previousMinute + nextMinute) / 2,
    );
    if (keepMinute === null) continue;

    for (const marker of betweenMarkers) {
      if (marker.kind === "placeholder" && marker.minute !== keepMinute) {
        markers.delete(marker.minute);
      }
    }
  }

  return markers;
};

const buildPlaceholderEmphasis = (
  placeholderMinutes: number[],
  currentMinute: number,
): Map<number, number> => {
  const emphasisByMinute = new Map<number, number>();
  for (const minute of placeholderMinutes) {
    emphasisByMinute.set(minute, MIN_PLACEHOLDER_EMPHASIS);
  }

  if (placeholderMinutes.length === 0) {
    return emphasisByMinute;
  }

  if (placeholderMinutes.length === 1) {
    emphasisByMinute.set(placeholderMinutes[0], MAX_PLACEHOLDER_EMPHASIS);
    return emphasisByMinute;
  }

  const firstMinute = placeholderMinutes[0];
  const lastMinute = placeholderMinutes[placeholderMinutes.length - 1];

  if (currentMinute <= firstMinute) {
    emphasisByMinute.set(firstMinute, MAX_PLACEHOLDER_EMPHASIS);
    return emphasisByMinute;
  }

  if (currentMinute >= lastMinute) {
    emphasisByMinute.set(lastMinute, MAX_PLACEHOLDER_EMPHASIS);
    return emphasisByMinute;
  }

  const upperIndex = placeholderMinutes.findIndex((minute) => minute >= currentMinute);
  if (upperIndex <= 0) {
    emphasisByMinute.set(firstMinute, MAX_PLACEHOLDER_EMPHASIS);
    return emphasisByMinute;
  }

  const lowerMinute = placeholderMinutes[upperIndex - 1];
  const upperMinute = placeholderMinutes[upperIndex];
  const progress = clamp01((currentMinute - lowerMinute) / (upperMinute - lowerMinute));
  const range = MAX_PLACEHOLDER_EMPHASIS - MIN_PLACEHOLDER_EMPHASIS;

  emphasisByMinute.set(lowerMinute, MIN_PLACEHOLDER_EMPHASIS + ((1 - progress) * range));
  emphasisByMinute.set(upperMinute, MIN_PLACEHOLDER_EMPHASIS + (progress * range));

  return emphasisByMinute;
};

export const TodaysAgenda = memo(function TodaysAgenda({
  tasks,
  selectedDate,
  isVisible = true,
  onToggle,
  onAddQuest,
  completedCount,
  totalCount,
  currentStreak = 0,
  onUndoToggle,
  onEditQuest,
  calendarTasks = [],
  calendarMilestones = [],
  onDateSelect,
  activeEpics = [],
  onDeleteQuest,
  onMoveQuestToNextDay,
  onUpdateScheduledTime,
  onTimeSlotLongPress,
  onSendToCalendar,
  hasCalendarLink,
  onTimelineDragPreviewTimeChange,
}: TodaysAgendaProps) {
  const prefersReducedMotion = useReducedMotion();
  const { capabilities } = useMotionProfile();
  const isNativeIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    const capacitor = (window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "ios");
  }, []);
  const useLiteAnimations = isNativeIOS || Boolean(prefersReducedMotion) || !capabilities.allowBackgroundAnimation;
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const keepInPlace = profile?.completed_tasks_stay_in_place ?? true;

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
  const [scheduledPaneMaxHeightPx, setScheduledPaneMaxHeightPx] = useState<number | null>(null);
  const setScheduledPaneNode = useCallback((node: HTMLDivElement | null) => {
    scheduledPaneRef.current = node;
    timelineDragContainerRef.current = node;
  }, []);
  
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [showMonthView, setShowMonthView] = useState(false);
  const [sortBy, setSortBy] = useState<'custom' | 'time' | 'priority' | 'xp'>('custom');
  const [justCompletedTasks, setJustCompletedTasks] = useState<Set<string>>(new Set());
  const [optimisticCompleted, setOptimisticCompleted] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [comboCount, setComboCount] = useState(0);
  const [showComboFx, setShowComboFx] = useState(false);
  const lastComboAtRef = useRef<number | null>(null);
  const comboResetTimerRef = useRef<number | null>(null);
  
  // Track touch start position to distinguish taps from scrolls
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // Clean up optimistic state when server confirms completion
  useEffect(() => {
    setOptimisticCompleted(prev => {
      const confirmedIds = tasks.filter(t => t.completed).map(t => t.id);
      const next = new Set(prev);
      confirmedIds.forEach(id => next.delete(id));
      return next.size !== prev.size ? next : prev;
    });
  }, [tasks]);

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
      setShowComboFx(true);
      window.setTimeout(() => {
        setShowComboFx(false);
      }, useLiteAnimations ? 600 : 1000);
    }
  }, [comboCount, scheduleComboReset, useLiteAnimations]);

  const resetCombo = useCallback(() => {
    if (comboResetTimerRef.current !== null) {
      window.clearTimeout(comboResetTimerRef.current);
      comboResetTimerRef.current = null;
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

  // Only quests go into the unified timeline (rituals grouped by campaign below)
  const scheduledItems = useMemo(
    () => questTasks
      .filter((task) => !!task.scheduled_time)
      .sort((a, b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || "")),
    [questTasks],
  );
  const anytimeItems = useMemo(
    () => questTasks.filter((task) => !task.scheduled_time),
    [questTasks],
  );
  const baseTimelineItems = useMemo(
    () => [...scheduledItems, ...anytimeItems],
    [scheduledItems, anytimeItems],
  );

  const draggableTimelineItems = useMemo(
    () => [...baseTimelineItems, ...ritualTasks],
    [baseTimelineItems, ritualTasks],
  );

  const timelineDrag = useTimelineDrag({
    containerRef: timelineDragContainerRef,
    snapConfig: SHARED_TIMELINE_DRAG_PROFILE,
    onDrop: (taskId, newTime) => {
      const overlapCount = getTaskConflictSetForTask(taskId, draggableTimelineItems, { [taskId]: newTime }).size;
      onUpdateScheduledTime?.(taskId, newTime);
      if (overlapCount > 0) {
        toast(`Overlap: ${overlapCount} quest${overlapCount === 1 ? "" : "s"}`);
      }
    },
  });
  const dragVisualOffsetY = (timelineDrag.dragVisualOffsetY ?? timelineDrag.dragOffsetY) as MotionValue<number>;
  const timelineRowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dragOverlaySnapshot, setDragOverlaySnapshot] = useState<DragOverlaySnapshot | null>(null);
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
  const lastReportedPreviewTimeRef = useRef<string | null>(null);
  const nowMarkerRowRef = useRef<HTMLDivElement | null>(null);
  const wasVisibleRef = useRef(isVisible);
  const wasTodayRef = useRef(isTodaySelected);
  const hadNowMarkerRef = useRef(false);

  useEffect(() => {
    const emitPreviewTime = timelineDrag.isDragging ? (timelineDrag.previewTime ?? null) : null;
    if (lastReportedPreviewTimeRef.current === emitPreviewTime) return;
    lastReportedPreviewTimeRef.current = emitPreviewTime;
    onTimelineDragPreviewTimeChange?.(emitPreviewTime);
  }, [onTimelineDragPreviewTimeChange, timelineDrag.isDragging, timelineDrag.previewTime]);

  useEffect(() => {
    return () => {
      onTimelineDragPreviewTimeChange?.(null);
    };
  }, [onTimelineDragPreviewTimeChange]);

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
        if (!timelineDrag.isDragging || edgeHoldDirectionRef.current !== direction) {
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
    [clearEdgeHoldRepeatTimer, timelineDrag.isDragging, timelineDrag.nudgeByFineStep],
  );

  const syncEdgeHoldState = useCallback(
    (nextDirection: -1 | 0 | 1, nextProfile: EdgeHoldProfile | null) => {
      if (!timelineDrag.isDragging || nextDirection === 0 || nextProfile === null) {
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
          if (!timelineDrag.isDragging || edgeHoldDirectionRef.current !== nextDirection) {
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
      timelineDrag.isDragging,
    ],
  );

  useLayoutEffect(() => {
    if (!timelineDrag.draggingTaskId) {
      setDragOverlaySnapshot(null);
      dragOverlayOffsetY.set(0);
      return;
    }

    let frameId: number | null = null;

    const captureSnapshot = () => {
      const rowNode = timelineRowRefs.current.get(timelineDrag.draggingTaskId!);
      if (!rowNode) return false;

      const rect = rowNode.getBoundingClientRect();
      const width = rect.width > 0 ? rect.width : rowNode.clientWidth || rowNode.offsetWidth || 1;
      const height = rect.height > 0 ? rect.height : rowNode.clientHeight || rowNode.offsetHeight || 1;
      setDragOverlaySnapshot({
        taskId: timelineDrag.draggingTaskId!,
        top: rect.top,
        left: rect.left,
        width,
        height,
      });
      dragOverlayBottomInsetRef.current = getBottomNavSafeOffsetPx();
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
  }, [dragOverlayOffsetY, timelineDrag.draggingTaskId]);

  useEffect(() => {
    if (!timelineDrag.isDragging || !dragOverlaySnapshot) {
      dragOverlayOffsetY.set(0);
      stopEdgeHold();
      return;
    }

    const clampDragOffset = (rawOffsetY: number) => {
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
      const clampedOffset = Math.max(minOffset, Math.min(maxOffset, rawOffsetY));
      dragOverlayOffsetY.set(clampedOffset);

      const clampDelta = rawOffsetY - clampedOffset;
      const pinnedDirection: -1 | 0 | 1 = clampDelta > EDGE_HOLD_PIN_THRESHOLD_PX
        ? 1
        : clampDelta < -EDGE_HOLD_PIN_THRESHOLD_PX
          ? -1
          : 0;
      const edgeHoldProfile = resolveEdgeHoldProfile(Math.abs(clampDelta));
      syncEdgeHoldState(pinnedDirection, edgeHoldProfile);
    };

    clampDragOffset(dragVisualOffsetY.get());
    const unsubscribe = dragVisualOffsetY.on("change", clampDragOffset);
    const handleViewportChange = () => clampDragOffset(dragVisualOffsetY.get());

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
      unsubscribe();
      stopEdgeHold();
      window.removeEventListener("resize", handleViewportChange);
      if (canListenToViewport) {
        viewport.removeEventListener("resize", handleViewportChange);
        viewport.removeEventListener("scroll", handleViewportChange);
      }
    };
  }, [dragOverlayOffsetY, dragOverlaySnapshot, dragVisualOffsetY, stopEdgeHold, syncEdgeHoldState, timelineDrag.isDragging]);

  useEffect(() => {
    if (timelineDrag.isDragging) return;
    stopEdgeHold();
  }, [stopEdgeHold, timelineDrag.isDragging]);

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

  const timelineMarkerRows = useMemo(() => {
    const isToday = isTodaySelected;
    const scheduledMinutes = scheduledItems
      .map((task) => parseTimeToMinute(task.scheduled_time))
      .filter((minute): minute is number => minute !== null);
    const sortedScheduledMinutes = [...scheduledMinutes].sort((a, b) => a - b);
    const timelineStartMinute = sortedScheduledMinutes.length > 0
      ? sortedScheduledMinutes[0]
      : DEFAULT_DAY_START_MINUTE;
    let placeholderMinutes = buildPlaceholderMinutes(sortedScheduledMinutes, timelineStartMinute);
    if (sortedScheduledMinutes.length > 0) {
      placeholderMinutes = placeholderMinutes.filter((minute) => minute > timelineStartMinute);
    }
    const nowAnchorMinute = Math.max(timelineStartMinute, Math.min(DAY_END_MINUTE, nowMarkerMinute));
    if (isToday && sortedScheduledMinutes.length === 0) {
      const lowerNowAnchor = Math.floor(nowAnchorMinute / PLACEHOLDER_INTERVAL_MINUTES) * PLACEHOLDER_INTERVAL_MINUTES;
      const upperNowAnchor = lowerNowAnchor + PLACEHOLDER_INTERVAL_MINUTES;
      if (lowerNowAnchor >= timelineStartMinute && lowerNowAnchor <= DAY_END_MINUTE) {
        placeholderMinutes.push(lowerNowAnchor);
      }
      if (upperNowAnchor >= timelineStartMinute && upperNowAnchor <= DAY_END_MINUTE) {
        placeholderMinutes.push(upperNowAnchor);
      }
    }
    const uniquePlaceholderMinutes = Array.from(new Set(placeholderMinutes)).sort((a, b) => a - b);
    const emphasisByMinute = isToday
      ? buildPlaceholderEmphasis(uniquePlaceholderMinutes, nowMarkerMinute)
      : new Map<number, number>(
          uniquePlaceholderMinutes.map((minute) => [minute, MIN_PLACEHOLDER_EMPHASIS]),
        );
    const markers = new Map<number, TimelineMarkerRow>();

    for (const minute of uniquePlaceholderMinutes) {
      markers.set(minute, {
        id: `timeline-marker-placeholder-${minuteToMarkerToken(minute)}`,
        minute,
        time: minuteToTime(minute),
        kind: "placeholder",
        emphasis: emphasisByMinute.get(minute) ?? MIN_PLACEHOLDER_EMPHASIS,
      });
    }

    if (isToday) {
      const clampedNowMinute = Math.max(0, Math.min(DAY_END_MINUTE, nowMarkerMinute));
      markers.set(clampedNowMinute, {
        id: "timeline-marker-now",
        minute: clampedNowMinute,
        time: minuteToTime(clampedNowMinute),
        kind: "now",
        emphasis: MAX_PLACEHOLDER_EMPHASIS,
      });
    }

    return Array.from(pruneMarkersBetweenConsecutiveQuests(markers, sortedScheduledMinutes).values());
  }, [isTodaySelected, nowMarkerMinute, scheduledItems]);

  const timelineRows = useMemo<TimelineRow[]>(() => {
    const scheduledRows: Array<TimelineRow & { minute: number; sortKey: string }> = [
      ...timelineMarkerRows.map((marker) => ({
        kind: "marker" as const,
        marker,
        minute: marker.minute,
        sortKey: `0-${marker.minute}-${marker.id}`,
      })),
      ...flowOrderedScheduledItems
        .map((task) => {
          const minute = parseTimeToMinute(task.scheduled_time);
          if (minute === null) return null;
          return {
            kind: "task" as const,
            task,
            minute,
            sortKey: `1-${minute}-${task.id}`,
          };
        })
        .filter((row): row is TimelineRow & { minute: number; sortKey: string } => !!row),
    ].sort((a, b) => {
      if (a.minute !== b.minute) return a.minute - b.minute;
      return a.sortKey.localeCompare(b.sortKey);
    });

    return scheduledRows.map((row) => (
      row.kind === "marker"
        ? { kind: "marker", marker: row.marker }
        : { kind: "task", task: row.task }
    ));
  }, [flowOrderedScheduledItems, timelineMarkerRows]);
  const hasNowMarkerRow = useMemo(
    () => timelineRows.some((row) => row.kind === "marker" && row.marker.kind === "now"),
    [timelineRows],
  );
  const hasRenderableNowMarker = hasNowMarkerRow && tasks.length > 0;

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const updateScheduledPaneBounds = () => {
      const pane = scheduledPaneRef.current;
      if (!pane) {
        setScheduledPaneMaxHeightPx(null);
        return;
      }

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const bottomOffset = getBottomNavSafeOffsetPx();
      const available = Math.floor(viewportHeight - pane.getBoundingClientRect().top - bottomOffset);
      if (!Number.isFinite(available)) return;
      setScheduledPaneMaxHeightPx(Math.max(120, available));
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
  }, [comboCount, hasRenderableNowMarker, isTodaySelected, tasks.length, timelineRows.length]);

  useEffect(() => {
    const isToday = isTodaySelected;
    const becameVisible = isVisible && !wasVisibleRef.current;
    const becameToday = isToday && !wasTodayRef.current;
    const gainedNowMarker = hasRenderableNowMarker && !hadNowMarkerRef.current;
    const shouldCenter =
      isVisible &&
      isToday &&
      hasRenderableNowMarker &&
      !timelineDrag.isDragging &&
      (becameVisible || becameToday || gainedNowMarker);

    if (shouldCenter && nowMarkerRowRef.current && typeof window !== "undefined") {
      const pane = scheduledPaneRef.current;
      if (pane && pane.scrollHeight > pane.clientHeight + 1) {
        const markerRect = nowMarkerRowRef.current.getBoundingClientRect();
        const paneRect = pane.getBoundingClientRect();
        const markerMidpointWithinPane = markerRect.top - paneRect.top + (markerRect.height / 2);
        const targetPaneScrollTop = pane.scrollTop + markerMidpointWithinPane - (pane.clientHeight * NOW_MARKER_VIEWPORT_TARGET);
        const maxPaneScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
        pane.scrollTo({
          top: Math.max(0, Math.min(maxPaneScrollTop, targetPaneScrollTop)),
          behavior: "smooth",
        });
      } else {
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
  }, [hasRenderableNowMarker, isTodaySelected, isVisible, timelineDrag.isDragging]);

  const baseTimelineConflictMap = useMemo(
    () => buildTaskConflictMap(draggableTimelineItems),
    [draggableTimelineItems],
  );

  const timelineConflictMap = baseTimelineConflictMap;
  const draggedScheduledTask = useMemo(() => {
    if (!timelineDrag.draggingTaskId) return null;
    return scheduledItemsById.get(timelineDrag.draggingTaskId) ?? null;
  }, [scheduledItemsById, timelineDrag.draggingTaskId]);
  const draggedScheduledFlow = useMemo(() => {
    if (!draggedScheduledTask) return null;
    return scheduledFlow.byTaskId.get(draggedScheduledTask.id) ?? null;
  }, [draggedScheduledTask, scheduledFlow.byTaskId]);
  const shouldRenderDragOverlay = Boolean(
    timelineDrag.isDragging &&
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

  // Group rituals by campaign
  const campaignRitualGroups = useMemo(() => {
    const groups: Array<{
      epicId: string;
      title: string;
      progress: number;
      daysLeft: number | null;
      rituals: Task[];
      completedCount: number;
      epic: typeof activeEpics[0];
    }> = [];

    const ritualsByEpic = new Map<string, Task[]>();
    for (const task of ritualTasks) {
      const epicId = task.epic_id;
      if (!epicId) continue;
      if (!ritualsByEpic.has(epicId)) ritualsByEpic.set(epicId, []);
      ritualsByEpic.get(epicId)!.push(task);
    }

    for (const epic of activeEpics) {
      const rituals = ritualsByEpic.get(epic.id);
      if (!rituals || rituals.length === 0) continue;
      groups.push({
        epicId: epic.id,
        title: epic.title,
        progress: Math.round(epic.progress_percentage ?? 0),
        daysLeft: getDaysLeft(epic.end_date),
        rituals,
        completedCount: rituals.filter(r => !!r.completed).length,
        epic,
      });
    }

    return groups;
  }, [ritualTasks, activeEpics]);

  // Keep expanded campaigns in sync when new epics appear
  useEffect(() => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const epic of activeEpics) {
        if (!next.has(epic.id)) {
          next.add(epic.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeEpics]);

  const toggleCampaignExpanded = useCallback((epicId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) next.delete(epicId);
      else next.add(epicId);
      return next;
    });
  }, []);



  

  const totalXP = tasks.reduce((sum, task) => {
    if (!task.completed) return sum;
    const taskXP = task.is_main_quest
      ? Math.round(task.xp_reward * MAIN_QUEST_XP_MULTIPLIER)
      : task.xp_reward;
    return sum + taskXP;
  }, 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const triggerHaptic = async (style: ImpactStyle) => {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      // Haptics not available on web
    }
  };

  // Check if a task has expandable details
  const hasExpandableDetails = useCallback((task: Task) => {
    return !!(
      (task.subtasks && task.subtasks.length > 0) ||
      task.notes || 
      task.priority || 
      task.energy_level || 
      task.estimated_duration || 
      (task.is_recurring && task.recurrence_pattern) || 
      task.difficulty ||
      task.category
    );
  }, []);

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

  const renderTaskItem = useCallback((task: Task, dragProps?: DragHandleProps, overlapCount = 0) => {
    const isComplete = !!task.completed || optimisticCompleted.has(task.id);
    const isRitual = !!task.habit_source_id;
    const effectiveTaskXP = task.is_main_quest
      ? Math.round(task.xp_reward * MAIN_QUEST_XP_MULTIPLIER)
      : task.xp_reward;
    const isDragging = dragProps?.isDragging ?? false;
    const isPressed = dragProps?.isPressed ?? false;
    const isActivated = dragProps?.isActivated ?? false;
    const isExpanded = expandedTasks.has(task.id);
    const hasDetails = hasExpandableDetails(task);
    const CategoryIcon = getCategoryIcon(task.category);
    const subtasks = task.subtasks ?? [];
    const completedSubtaskCount = subtasks.filter(subtask => !!subtask.completed).length;
    const hasDetailBadges = !!(
      (CategoryIcon && task.category) ||
      task.difficulty ||
      task.priority ||
      task.energy_level ||
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

    const taskContent = (
      <Collapsible open={isExpanded} onOpenChange={() => {}}>
        <div
          className={cn(
            "flex items-center gap-3 transition-all relative group",
            "select-none min-h-[46px]",
            isRitual ? "py-3" : "py-2",
            isComplete && "opacity-60",
            isDragging && "cursor-grabbing",
            isActivated && !isDragging && "bg-muted/30 rounded-lg"
          )}
        >
          {/* Checkbox - only this toggles completion */}
          <div className="relative ml-1 flex flex-col items-center self-start pt-0.5 gap-0">
            <button
              data-interactive="true"
              onClick={handleCheckboxClick}
              onTouchStart={(e) => {
                touchStartRef.current = { 
                  x: e.touches[0].clientX, 
                  y: e.touches[0].clientY 
                };
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isRitual && (
                <Repeat className="w-4 h-4 text-accent flex-shrink-0" />
              )}
              <MarqueeText
                text={task.task_text}
                className={cn(
                  "text-sm flex-1",
                  isComplete && "text-muted-foreground",
                  isComplete && (justCompletedTasks.has(task.id) ? "animate-strikethrough" : "line-through")
                )}
              />
            </div>
            {task.scheduled_time && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {formatTime(task.scheduled_time)}
              </span>
            )}
            {overlapCount > 0 && (
              <span className="mt-1 inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Overlaps: {overlapCount}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Quest action menu */}
            {!isComplete && !isDragging && !isActivated && (onEditQuest || onSendToCalendar || onDeleteQuest || onMoveQuestToNextDay) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    data-interactive="true"
                    aria-label="Quest actions"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 -m-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:focus-visible:opacity-100 transition-opacity touch-manipulation"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {onEditQuest && (
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
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
            {hasDetails && (
              <Button
                data-interactive="true"
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

        {/* Expandable details section */}
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

            {/* Notes */}
            {task.notes && (
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
              
              {/* Energy level */}
              {task.energy_level && (
                <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5 gap-1 border-muted-foreground/30">
                  <Zap className="w-3 h-3" />
                  {task.energy_level}
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
                  {task.recurrence_pattern}
                </Badge>
              )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );

    return taskContent;
  }, [onToggle, onUndoToggle, onEditQuest, onSendToCalendar, hasCalendarLink, onDeleteQuest, onMoveQuestToNextDay, expandedTasks, hasExpandableDetails, toggleTaskExpanded, justCompletedTasks, optimisticCompleted, toggleSubtask, useLiteAnimations, registerCompletionCombo, resetCombo]);


  return (
    <div className="relative">
      <div className="relative px-2 py-2 overflow-visible">
        {/* Compact Header: Date + Progress Ring + XP */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowMonthView(true)}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <span className="text-lg font-bold">
                {safeFormat(selectedDate, "MMM d, yyyy", "Invalid date")}
              </span>
            </button>
            {currentStreak > 0 && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
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

          <div className="flex items-center gap-2">
            {/* Compact progress ring */}
            {totalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <ProgressRing percent={progressPercent} size={24} strokeWidth={2.5} />
                <span className="text-xs font-medium text-muted-foreground">
                  {completedCount}/{totalCount}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-sm">
              <Trophy className={cn(
                "h-4 w-4",
                allComplete ? "text-stardust-gold" : "text-stardust-gold/70"
              )} />
              <span className="font-semibold text-stardust-gold">{totalXP}</span>
            </div>
          </div>
        </div>

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
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <Circle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No tasks for this day
            </p>
            <p className="text-xs text-muted-foreground/70">
              Tap <Plus className="w-3 h-3 inline" /> to add your first quest
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onAddQuest}
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Add Quest
            </Button>
          </div>
        ) : (
          <div>
            {/* Sort dropdown */}
            <div className="flex items-center gap-2 mb-1">
              {tasks.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded opacity-40 hover:opacity-70 transition-opacity flex-shrink-0">
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-28">
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
            </div>

            {/* Scheduled Tasks Timeline */}
            {timelineRows.length > 0 && (
              <div>
                <div
                  ref={setScheduledPaneNode}
                  className="overflow-y-auto overscroll-contain pr-1"
                  style={scheduledPaneMaxHeightPx ? { maxHeight: `${scheduledPaneMaxHeightPx}px` } : undefined}
                  data-testid="scheduled-timeline-pane"
                >
                  {timelineRows.map((row, index) => {
                    if (row.kind === "marker") {
                      const marker = row.marker;
                      const previousRow = index > 0 ? timelineRows[index - 1] : null;
                      const nextRow = index < timelineRows.length - 1 ? timelineRows[index + 1] : null;
                      const previousTaskMinute = previousRow?.kind === "task"
                        ? parseTimeToMinute(previousRow.task.scheduled_time)
                        : null;
                      const nextTaskMinute = nextRow?.kind === "task"
                        ? parseTimeToMinute(nextRow.task.scheduled_time)
                        : null;
                      const isBetweenQuestMarker = previousTaskMinute !== null
                        && nextTaskMinute !== null
                        && previousTaskMinute < marker.minute
                        && marker.minute < nextTaskMinute;
                      const markerScale = marker.kind === "placeholder"
                        ? 0.72 + (marker.emphasis * 0.28)
                        : 1;
                      const markerOpacity = marker.kind === "placeholder"
                        ? 0.25 + (marker.emphasis * 0.65)
                        : 1;
                      const markerTransform = isBetweenQuestMarker
                        ? `translateY(-50%) scale(${markerScale})`
                        : `scale(${markerScale})`;
                      return (
                        <div
                          key={marker.id}
                          className={cn(
                            "pointer-events-none select-none",
                            isBetweenQuestMarker && "h-0 overflow-visible",
                          )}
                          data-testid={marker.id}
                        >
                          <div
                            ref={marker.kind === "now" ? nowMarkerRowRef : undefined}
                            style={{
                              opacity: markerOpacity,
                              transform: markerTransform,
                              transformOrigin: "left center",
                            }}
                          >
                            <TimelineTaskRow
                              rowKind="marker"
                              time={marker.time}
                              tone={marker.kind === "now" ? "now" : "default"}
                              showLine={index > 0}
                              isLast={index === timelineRows.length - 1}
                            >
                              <div className="h-px" />
                            </TimelineTaskRow>
                          </div>
                        </div>
                      );
                    }

                    const task = row.task;
                    const isThisDragging = timelineDrag.draggingTaskId === task.id;
                    const isAnyDragging = timelineDrag.isDragging;
                    const isJustDropped = timelineDrag.justDroppedId === task.id;
                    const usesOverlayPlaceholder = isThisDragging && shouldRenderDragOverlay;
                    const rowFlow = scheduledFlow.byTaskId.get(task.id);
                    const laneIndex = rowFlow?.laneIndex;
                    const laneCount = rowFlow?.laneCount;
                    const laneOffsetPx = rowFlow
                      ? getLaneOffsetPx(rowFlow.laneIndex, rowFlow.overlapCount)
                      : 0;
                    const timelineRowDragProps = task.scheduled_time && !task.completed
                      ? timelineDrag.getRowDragProps(task.id, task.scheduled_time)
                      : undefined;
                    const isRowDraggable = !!timelineRowDragProps;
                    const overlapCount = timelineConflictMap.get(task.id)?.size ?? 0;

                    const rowStyle: CSSProperties = {
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      WebkitTouchCallout: 'none',
                      touchAction: isThisDragging && !usesOverlayPlaceholder ? 'none' : 'pan-y',
                      pointerEvents: isAnyDragging && !isThisDragging ? 'none' : 'auto',
                      opacity: usesOverlayPlaceholder ? 0 : isAnyDragging && !isThisDragging ? 0.7 : 1,
                      boxShadow: isThisDragging && !usesOverlayPlaceholder
                        ? "0 15px 30px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -4px rgba(0, 0, 0, 0.15)"
                        : "none",
                      backgroundColor: isThisDragging && !usesOverlayPlaceholder ? "hsl(var(--background))" : "transparent",
                      borderRadius: isThisDragging && !usesOverlayPlaceholder ? 12 : 0,
                      transition: 'none',
                      willChange: isThisDragging && !usesOverlayPlaceholder ? "transform" : undefined,
                    };

                    const rowContent = (
                      <TimelineTaskRow
                        rowKind="task"
                        time={task.scheduled_time}
                        overrideTime={isThisDragging ? timelineDrag.previewTime : undefined}
                        showLine={index > 0}
                        isLast={index === timelineRows.length - 1}
                        isDragTarget={isThisDragging}
                        durationMinutes={task.estimated_duration}
                        laneIndex={laneIndex}
                        laneCount={laneCount}
                        overlapCount={rowFlow?.overlapCount}
                        className={cn(
                          isRowDraggable && !isThisDragging && "cursor-grab active:cursor-grabbing",
                          isThisDragging && "cursor-grabbing",
                        )}
                        data-testid={`timeline-row-${task.id}`}
                        {...timelineRowDragProps}
                      >
                        {renderTaskItem(task, undefined, overlapCount)}
                      </TimelineTaskRow>
                    );

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
                        className={cn("relative", isThisDragging && !usesOverlayPlaceholder && "z-50")}
                        layout={!isThisDragging || usesOverlayPlaceholder}
                        animate={bounceAnimation}
                        transition={bounceAnimation ? {
                          duration: 0.25,
                          ease: [0.25, 0.1, 0.25, 1],
                          layout: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 },
                        } : {
                          layout: { type: "spring", stiffness: 420, damping: 34, mass: 0.7 },
                        }}
                        data-timeline-lane={laneIndex}
                        data-timeline-lane-count={laneCount}
                        data-timeline-overlap={rowFlow?.overlapCount}
                        style={{
                          ...rowStyle,
                          x: laneOffsetPx,
                          y: isThisDragging && !usesOverlayPlaceholder ? dragVisualOffsetY : 0,
                        }}
                      >
                        {rowContent}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inbox section removed - now has its own tab */}

        {/* Campaign Dropdown Folders with Rituals */}
        {campaignRitualGroups.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/30">
            {/* Campaigns divider */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 flex-shrink-0" />
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <Target className="h-3 w-3" />
                Campaigns
              </div>
              <div className="flex-1 border-t border-dashed border-border/40" />
            </div>

            <div className="space-y-2">
              {campaignRitualGroups.map(group => {
                const isCampaignExpanded = expandedCampaigns.has(group.epicId);
                return (
                  <div key={group.epicId} className="rounded-xl border border-border/30 bg-card/30 overflow-hidden">
                    {/* Campaign Header */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <JourneyPathDrawer epic={{
                        id: group.epic.id,
                        title: group.epic.title,
                        description: group.epic.description ?? undefined,
                        progress_percentage: group.epic.progress_percentage ?? 0,
                        target_days: group.epic.target_days,
                        start_date: group.epic.start_date,
                        end_date: group.epic.end_date,
                        epic_habits: group.epic.epic_habits,
                      }}>
                        <button className="flex items-center gap-2 min-w-0 flex-1 text-left focus:outline-none">
                          <Target className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{group.title}</span>
                        </button>
                      </JourneyPathDrawer>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-primary font-bold text-xs">{group.progress}%</span>
                        {group.daysLeft !== null && (
                          <span className="text-muted-foreground text-xs">{group.daysLeft}d</span>
                        )}
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                          {group.completedCount}/{group.rituals.length}
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCampaignExpanded(group.epicId);
                          }}
                          className="p-1 -m-1 focus:outline-none"
                        >
                          {isCampaignExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Rituals */}
                    {isCampaignExpanded && (
                      <div className="border-t border-border/20 px-2 pb-1">
                        {group.rituals.map(task => {
                          const isThisDragging = timelineDrag.draggingTaskId === task.id;
                          const isAnyDragging = timelineDrag.isDragging;
                          const overlapCount = timelineConflictMap.get(task.id)?.size ?? 0;

                          return (
                            <motion.div
                              key={task.id}
                              className={cn("relative", isThisDragging && "z-50")}
                              style={{
                                y: isThisDragging ? timelineDrag.dragOffsetY : 0,
                                pointerEvents: isAnyDragging && !isThisDragging ? "none" : "auto",
                                opacity: isAnyDragging && !isThisDragging ? 0.7 : 1,
                              }}
                            >
                              {renderTaskItem(task, undefined, overlapCount)}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Campaign Strip (for epics with no rituals today) */}
        {activeEpics && activeEpics.length > 0 && ritualTasks.length === 0 && (
          <div className="mt-4 pt-3 border-t border-border/20 space-y-2">
            {activeEpics.map(epic => {
              const progress = Math.round(epic.progress_percentage ?? 0);
              const daysLeft = getDaysLeft(epic.end_date);
              return (
                <JourneyPathDrawer key={epic.id} epic={{
                  id: epic.id,
                  title: epic.title,
                  description: epic.description ?? undefined,
                  progress_percentage: epic.progress_percentage ?? 0,
                  target_days: epic.target_days,
                  start_date: epic.start_date,
                  end_date: epic.end_date,
                  epic_habits: epic.epic_habits,
                }}>
                  <button className="w-full text-left focus:outline-none">
                    <div className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-muted/30 border border-border/30 bg-card/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <Target className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate max-w-[140px]">{epic.title}</span>
                        <span className="text-primary font-bold text-xs shrink-0">{progress}%</span>
                        {daysLeft !== null && (
                          <span className="text-muted-foreground text-xs shrink-0">· {daysLeft}d</span>
                        )}
                      </div>
                    </div>
                  </button>
                </JourneyPathDrawer>
              );
            })}
          </div>
        )}
      </div>

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
                overrideTime={timelineDrag.previewTime ?? undefined}
                isDragTarget
                durationMinutes={draggedScheduledTask.estimated_duration}
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

      <HourlyViewModal
        open={showMonthView}
        onOpenChange={setShowMonthView}
        selectedDate={selectedDate}
        onDateSelect={(date) => {
          if (onDateSelect) onDateSelect(date);
        }}
        tasks={calendarTasks}
        milestones={calendarMilestones}
        onTaskDrop={() => {}}
        onTimeSlotLongPress={onTimeSlotLongPress}
      />

      <DragTimeZoomRail rail={timelineDrag.zoomRail} />
    </div>
  );
});
