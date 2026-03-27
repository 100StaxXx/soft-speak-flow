import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { format } from "date-fns";
import type { StoryTypeSlug } from "@/types/narrativeTypes";
import type { EpicRecord } from "@/hooks/epicsQuery";
import { useResilience } from "@/contexts/ResilienceContext";
import {
  PLANNER_SYNC_EVENT,
  loadLocalEpics,
  warmEpicsQueryFromRemote,
} from "@/utils/plannerSync";
import {
  createOfflinePlannerId,
  getAllLocalTasksForUser,
  getLocalEpicHabits,
  getLocalHabitCompletions,
  getLocalHabits,
  getLocalJourneyPhases,
  getLocalEpicMilestones,
  removePlannerRecord,
  removePlannerRecords,
  upsertPlannerRecord,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";

const normalizeDifficulty = (value: string): "easy" | "medium" | "hard" => {
  const lower = value?.toLowerCase()?.trim() || "medium";
  if (["easy", "simple", "beginner", "low"].includes(lower)) return "easy";
  if (["hard", "difficult", "advanced", "high", "challenging"].includes(lower)) return "hard";
  return "medium";
};

const normalizeFrequency = (value: string): "daily" | "5x_week" | "3x_week" | "monthly" | "custom" => {
  const lower = value?.toLowerCase()?.trim()?.replace(/\s+/g, "_") || "daily";
  if (["daily", "everyday", "every_day", "7x_week", "7x"].includes(lower)) return "daily";
  if (["5x_week", "5x", "weekdays", "five_times", "5_times"].includes(lower)) return "5x_week";
  if (["3x_week", "3x", "three_times", "3_times", "thrice"].includes(lower)) return "3x_week";
  if (["monthly", "month", "every_month"].includes(lower)) return "monthly";
  if (["weekly", "biweekly", "twice", "2x", "2x_week", "once", "1x", "custom", "twice_daily"].includes(lower)) return "custom";
  return "daily";
};

const normalizeThemeColor = (value: string | undefined): "heroic" | "warrior" | "mystic" | "nature" | "solar" => {
  if (!value) return "heroic";
  const lower = value.toLowerCase().trim();

  if (["heroic", "warrior", "mystic", "nature", "solar"].includes(lower)) {
    return lower as "heroic" | "warrior" | "mystic" | "nature" | "solar";
  }

  const hexMap: Record<string, "heroic" | "warrior" | "mystic" | "nature" | "solar"> = {
    "#f59e0b": "heroic",
    "#ef4444": "warrior",
    "#10b981": "nature",
    "#ec4899": "mystic",
    "#f97316": "solar",
    "#8b5cf6": "mystic",
    "#3b82f6": "heroic",
    "#475569": "warrior",
  };

  return hexMap[lower] || "heroic";
};

interface EpicsOptions {
  enabled?: boolean;
}

const ACTIVE_CAMPAIGN_LIMIT = 3;
const CAMPAIGN_LIMIT_REACHED_MESSAGE =
  `You can only have ${ACTIVE_CAMPAIGN_LIMIT} active campaigns at a time. Complete or abandon one before creating another.`;

type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const toErrorHaystack = (error: unknown): string => {
  if (!error) return "";

  if (typeof error === "string") {
    return error.toLowerCase();
  }

  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  if (typeof error === "object") {
    const candidate = error as ErrorLike;
    return `${candidate.message ?? ""} ${candidate.details ?? ""} ${candidate.hint ?? ""} ${candidate.code ?? ""}`.toLowerCase();
  }

  return "";
};

const isLegacyMonthSchemaError = (error: unknown): boolean => {
  const haystack = toErrorHaystack(error);

  return (
    haystack.includes("custom_month_days") ||
    (haystack.includes("habits_frequency_check") && haystack.includes("monthly")) ||
    (haystack.includes("frequency") && haystack.includes("monthly") && haystack.includes("check"))
  );
};

export const normalizeCreateCampaignError = (error: unknown): { title: string; description?: string } => {
  const haystack = toErrorHaystack(error);

  if (
    haystack.includes("3 active epics") ||
    haystack.includes("active epics at a time") ||
    haystack.includes("active campaigns at a time")
  ) {
    return {
      title: "Campaign limit reached",
      description: CAMPAIGN_LIMIT_REACHED_MESSAGE,
    };
  }

  if (haystack.includes("not authenticated") || haystack.includes("jwt") || haystack.includes("auth")) {
    return {
      title: "Sign in required",
      description: "Please refresh and sign in again before creating a campaign.",
    };
  }

  if (haystack.includes("maximum active habit limit reached")) {
    return {
      title: "Too many active rituals",
      description: "Your account hit a legacy ritual limit. Update your app data and try creating this campaign again.",
    };
  }

  if (isLegacyMonthSchemaError(error)) {
    return {
      title: "Campaign setup update needed",
      description: "Your planner data is missing a recent ritual scheduling update. Please try again shortly.",
    };
  }

  if (haystack.includes("failed to create habits") || haystack.includes("no habits were created")) {
    return {
      title: "Failed to create campaign",
      description: "We couldn't save your rituals. Please review your plan and try again.",
    };
  }

  return {
    title: "Failed to create campaign",
    description: "Please try again in a moment. If this keeps happening, close and reopen the planner.",
  };
};

type LocalHabitRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  difficulty: string | null;
  frequency: string;
  custom_days: number[] | null;
  custom_month_days: number[] | null;
  preferred_time: string | null;
  reminder_enabled: boolean | null;
  reminder_minutes_before: number | null;
  estimated_minutes: number | null;
  category: string | null;
  is_active: boolean | null;
  current_streak: number | null;
  longest_streak: number | null;
  created_at: string | null;
};

type LocalEpicRow = EpicRecord;

type LocalEpicPayload = {
  epic: LocalEpicRow;
  habits: LocalHabitRow[];
  epicHabits: Array<{ id: string; epic_id: string; habit_id: string }>;
  phases: Array<{ id: string; epic_id: string; user_id: string; name: string; description: string; start_date: string; end_date: string; phase_order: number }>;
  milestones: Array<{ id: string; epic_id: string; user_id: string; title: string; description: string | null; target_date: string; milestone_percent: number; is_postcard_milestone: boolean; phase_order: number; phase_name: string | null }>;
};

async function applyLocalEpicPayload(payload: LocalEpicPayload) {
  await upsertPlannerRecords("habits", payload.habits);
  await upsertPlannerRecord("epics", payload.epic);
  await upsertPlannerRecords("epic_habits", payload.epicHabits);
  await upsertPlannerRecords("journey_phases", payload.phases);
  await upsertPlannerRecords("epic_milestones", payload.milestones);
}

async function applyLocalEpicStatusChange(userId: string, epicId: string, status: "completed" | "abandoned") {
  const localEpics = await loadLocalEpics(userId);
  const epic = localEpics.find((candidate) => candidate.id === epicId);
  if (!epic) {
    throw new Error("Epic not found");
  }

  await upsertPlannerRecord("epics", {
    ...epic,
    status,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  });

  if (status !== "abandoned") {
    return;
  }

  const [epicHabits, habits, milestones, tasks] = await Promise.all([
    getLocalEpicHabits<Array<{ id: string; epic_id: string; habit_id: string }>[number]>([epicId]),
    getLocalHabits<LocalHabitRow>(userId),
    getLocalEpicMilestones<Array<{ id: string; epic_id: string; user_id: string }>[number]>(epicId),
    getAllLocalTasksForUser<Array<{ id: string; habit_source_id: string | null; task_date: string | null; completed: boolean | null }>[number]>(userId),
  ]);

  const today = format(new Date(), "yyyy-MM-dd");
  const habitIds = epicHabits.map((link) => link.habit_id);

  await Promise.all(
    habits
      .filter((habit) => habitIds.includes(habit.id))
      .map((habit) =>
        upsertPlannerRecord("habits", {
          ...habit,
          is_active: false,
        }),
      ),
  );

  const tasksToDelete = tasks
    .filter((task) =>
      task.habit_source_id
      && habitIds.includes(task.habit_source_id)
      && task.task_date
      && task.task_date >= today
      && task.completed !== true)
    .map((task) => task.id);

  if (tasksToDelete.length > 0) {
    await removePlannerRecords("daily_tasks", tasksToDelete);
  }

  if (epicHabits.length > 0) {
    await removePlannerRecords("epic_habits", epicHabits.map((link) => link.id));
  }
  if (milestones.length > 0) {
    await removePlannerRecords("epic_milestones", milestones.map((milestone) => milestone.id));
  }
}

async function applyRemoteEpicStatusChange(userId: string, epicId: string, status: "completed" | "abandoned") {
  const { error } = await supabase
    .from("epics")
    .update({
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", epicId)
    .eq("user_id", userId);

  if (error) throw error;

  if (status !== "abandoned") {
    return;
  }

  const { data: epicHabits, error: epicHabitsError } = await supabase
    .from("epic_habits")
    .select("id, habit_id")
    .eq("epic_id", epicId);

  if (epicHabitsError) throw epicHabitsError;

  const habitIds = epicHabits?.map((row) => row.habit_id) ?? [];
  if (habitIds.length > 0) {
    const { error: habitsError } = await supabase
      .from("habits")
      .update({ is_active: false })
      .in("id", habitIds)
      .eq("user_id", userId);
    if (habitsError) throw habitsError;

    const today = format(new Date(), "yyyy-MM-dd");
    const { error: tasksError } = await supabase
      .from("daily_tasks")
      .delete()
      .in("habit_source_id", habitIds)
      .gte("task_date", today)
      .eq("completed", false)
      .eq("user_id", userId);
    if (tasksError) throw tasksError;

    const linkIds = epicHabits?.map((row) => row.id) ?? [];
    if (linkIds.length > 0) {
      const { error: linksError } = await supabase
        .from("epic_habits")
        .delete()
        .in("id", linkIds);
      if (linksError) throw linksError;
    }
  }

  const { error: milestonesError } = await supabase
    .from("epic_milestones")
    .delete()
    .eq("epic_id", epicId)
    .eq("user_id", userId);
  if (milestonesError) throw milestonesError;
}

export const useEpics = (options: EpicsOptions = {}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { trackEpicOutcome } = useAIInteractionTracker();
  const { queueAction, shouldQueueWrites, retryNow } = useResilience();
  const { enabled = true } = options;

  const epicsQuery = useQuery({
    queryKey: ["epics", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return loadLocalEpics(user.id);
    },
    enabled: enabled && !!user?.id,
    placeholderData: (previousData) => previousData,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!enabled || !user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      try {
        await warmEpicsQueryFromRemote(queryClient, user.id);
        if (disposed) return;
      } catch (error) {
        console.warn("Failed to sync local epics from remote:", error);
      }
    };

    void refreshFromRemote();

    const handlePlannerSync = () => {
      void refreshFromRemote();
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      disposed = true;
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [enabled, queryClient, user?.id]);

  const epics = epicsQuery.data ?? [];

  const createEpic = useMutation({
    mutationFn: async (epicData: {
      title: string;
      description?: string;
      target_days: number;
      is_public?: boolean;
      theme_color?: string;
      story_type_slug?: StoryTypeSlug;
      habits: Array<{
        title: string;
        description?: string;
        difficulty: string;
        frequency: string;
        custom_days: number[];
        custom_month_days?: number[];
        preferred_time?: string;
        reminder_enabled?: boolean;
        reminder_minutes_before?: number;
        estimated_minutes?: number;
      }>;
      milestones?: Array<{
        title: string;
        description?: string;
        target_date: string;
        milestone_percent: number;
        is_postcard_milestone: boolean;
        phase_name?: string;
        phaseName?: string;
      }>;
      phases?: Array<{
        name: string;
        description: string;
        start_date: string;
        end_date: string;
        phase_order: number;
      }>;
    }) => {
      if (!user?.id) {
        throw new Error("Not authenticated. Please refresh and try again.");
      }

      if (!epicData.habits || epicData.habits.length === 0) {
        throw new Error("Campaign must have at least one ritual");
      }

      if (epics.filter((epic) => epic.status === "active").length >= ACTIVE_CAMPAIGN_LIMIT) {
        throw new Error(CAMPAIGN_LIMIT_REACHED_MESSAGE);
      }

      const nowIso = new Date().toISOString();
      const epicId = createOfflinePlannerId("epic");
      const inviteCode = `EPIC-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const habits = epicData.habits.map((habit) => ({
        id: createOfflinePlannerId("habit"),
        user_id: user.id,
        title: habit.title,
        description: habit.description || null,
        difficulty: normalizeDifficulty(habit.difficulty),
        frequency: normalizeFrequency(habit.frequency),
        custom_days: habit.custom_days?.length ? habit.custom_days : null,
        custom_month_days: habit.custom_month_days?.length ? habit.custom_month_days : null,
        preferred_time: habit.preferred_time || null,
        reminder_enabled: habit.reminder_enabled || false,
        reminder_minutes_before: habit.reminder_minutes_before || 15,
        estimated_minutes: habit.estimated_minutes || null,
        category: null,
        is_active: true,
        current_streak: 0,
        longest_streak: 0,
        created_at: nowIso,
      })) satisfies LocalHabitRow[];

      const epic: LocalEpicRow = {
        id: epicId,
        user_id: user.id,
        title: epicData.title,
        description: epicData.description || null,
        status: "active",
        progress_percentage: 0,
        target_days: epicData.target_days,
        start_date: nowIso.split("T")[0],
        end_date: null,
        epic_habits: [],
        xp_reward: Math.floor(epicData.target_days * 10),
        invite_code: inviteCode,
        theme_color: normalizeThemeColor(epicData.theme_color),
        story_type_slug: epicData.story_type_slug || null,
        created_at: nowIso,
        completed_at: null,
      } as LocalEpicRow;

      const epicHabits = habits.map((habit) => ({
        id: createOfflinePlannerId("epic-habit"),
        epic_id: epicId,
        habit_id: habit.id,
      }));

      const phases = (epicData.phases ?? []).map((phase) => ({
        id: createOfflinePlannerId("journey-phase"),
        epic_id: epicId,
        user_id: user.id,
        name: phase.name,
        description: phase.description,
        start_date: phase.start_date,
        end_date: phase.end_date,
        phase_order: phase.phase_order,
      }));

      const milestones = (epicData.milestones ?? []).map((milestone, index) => ({
        id: createOfflinePlannerId("epic-milestone"),
        epic_id: epicId,
        user_id: user.id,
        title: milestone.title,
        description: milestone.description || null,
        target_date: milestone.target_date,
        milestone_percent: milestone.milestone_percent,
        is_postcard_milestone: milestone.is_postcard_milestone ?? false,
        phase_order: index + 1,
        phase_name: milestone.phase_name || milestone.phaseName || null,
      }));

      const payload: LocalEpicPayload = {
        epic,
        habits,
        epicHabits,
        phases,
        milestones,
      };

      await applyLocalEpicPayload(payload);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "EPIC_CREATE",
          entityType: "epic",
          entityId: epicId,
          payload,
        });
        return { queued: true, epic };
      }

      const { data: activeCampaignCount, error: countError } = await supabase.rpc("count_user_epics", {
        p_user_id: user.id,
      });
      if (countError) {
        console.error("Failed to check active campaign limit (continuing):", countError);
      } else if ((activeCampaignCount ?? 0) >= ACTIVE_CAMPAIGN_LIMIT) {
        throw new Error(CAMPAIGN_LIMIT_REACHED_MESSAGE);
      }

      try {
        const { error: habitsError } = await supabase.from("habits").insert(habits);
        if (habitsError) throw habitsError;

        const { error: epicError } = await supabase.from("epics").insert(epic);
        if (epicError) throw epicError;

        if (epicHabits.length > 0) {
          const { error: linkError } = await supabase.from("epic_habits").insert(epicHabits);
          if (linkError) throw linkError;
        }

        if (phases.length > 0) {
          const { error: phasesError } = await supabase.from("journey_phases").insert(phases);
          if (phasesError) throw phasesError;
        }

        if (milestones.length > 0) {
          const { error: milestonesError } = await supabase.from("epic_milestones").insert(milestones);
          if (milestonesError) throw milestonesError;
        }

        return { queued: false, epic };
      } catch (error) {
        await queueAction({
          actionKind: "EPIC_CREATE",
          entityType: "epic",
          entityId: epicId,
          payload,
        });
        void retryNow();
        return { queued: true, epic };
      }
    },
    onSuccess: ({ queued }) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      window.dispatchEvent(new CustomEvent("campaign-created"));
      toast.success(queued ? "Campaign saved offline" : "Campaign created! 🎯", {
        description: queued
          ? "Your campaign will sync when you're back online."
          : "Your companion is excited for this new journey!",
      });
    },
    onError: (error) => {
      console.error("Failed to create campaign:", error);
      const normalized = normalizeCreateCampaignError(error);
      toast.error(normalized.title, {
        description: normalized.description,
      });
    },
  });

  const updateEpicStatus = useMutation({
    mutationFn: async ({
      epicId,
      status,
    }: {
      epicId: string;
      status: "completed" | "abandoned";
    }) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const epic = epics.find((candidate) => candidate.id === epicId);
      if (!epic) {
        throw new Error("Epic not found or you don't have permission");
      }

      if (epic.status === "completed" && status === "completed") {
        throw new Error("Epic is already completed");
      }

      await applyLocalEpicStatusChange(user.id, epicId, status);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "EPIC_STATUS_UPDATE",
          entityType: "epic",
          entityId: epicId,
          payload: { epicId, status },
        });
        return { epic, status, wasAlreadyCompleted: epic.status === "completed", queued: true };
      }

      try {
        await applyRemoteEpicStatusChange(user.id, epicId, status);
      } catch (error) {
        await queueAction({
          actionKind: "EPIC_STATUS_UPDATE",
          entityType: "epic",
          entityId: epicId,
          payload: { epicId, status },
        });
        void retryNow();
        return { epic, status, wasAlreadyCompleted: epic.status === "completed", queued: true };
      }

      return { epic, status, wasAlreadyCompleted: epic.status === "completed", queued: false };
    },
    onSuccess: async ({ epic, status, wasAlreadyCompleted, queued }, variables) => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });

      if (status === "completed" || status === "abandoned") {
        trackEpicOutcome(variables.epicId, status).catch((err) => {
          console.error("Failed to track epic outcome:", err);
        });
      }

      if (queued) {
        toast(status === "abandoned" ? "Campaign abandoned offline" : "Campaign completed offline", {
          description: "We'll sync this campaign change when you're back online.",
        });
        return;
      }

      if (status === "completed" && !wasAlreadyCompleted) {
        try {
          await awardCustomXP(
            epic.xp_reward,
            "epic_complete",
            `Epic "${epic.title}" Completed!`,
            { epic_id: variables?.epicId },
          );
        } catch (error) {
          console.error("Failed to award epic completion XP:", error);
        }
        toast.success("Epic Completed! 🏆", {
          description: `You've conquered the ${epic.title} epic! Your companion grows stronger!`,
        });
      } else if (status === "abandoned") {
        toast("Epic abandoned", {
          description: "You can always start a new epic when ready.",
        });
      }
    },
    onError: (error) => {
      console.error("Failed to update epic:", error);
      toast.error("Failed to update epic status");
    },
  });

  const addHabitToEpic = useMutation({
    mutationFn: async ({
      epicId,
      habitId,
    }: {
      epicId: string;
      habitId: string;
    }) => {
      if (!epicId || !habitId) {
        throw new Error("Invalid epic or habit ID");
      }

      const existing = await getLocalEpicHabits<Array<{ id: string; epic_id: string; habit_id: string }>[number]>([epicId]);
      if (existing.some((row) => row.habit_id === habitId)) {
        throw new Error("Habit is already linked to this epic");
      }

      const row = {
        id: createOfflinePlannerId("epic-habit"),
        epic_id: epicId,
        habit_id: habitId,
      };
      await upsertPlannerRecord("epic_habits", row);

      const { error } = await supabase
        .from("epic_habits")
        .insert(row);

      if (error) {
        console.error("Failed to link habit to epic:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast.success("Habit linked to epic! ⚔️");
    },
    onError: (error) => {
      console.error("Failed to link habit:", error);
      toast.error("Failed to link habit to epic");
    },
  });

  const removeHabitFromEpic = useMutation({
    mutationFn: async ({
      epicId,
      habitId,
    }: {
      epicId: string;
      habitId: string;
    }) => {
      if (!epicId || !habitId) {
        throw new Error("Invalid epic or habit ID");
      }

      const existing = await getLocalEpicHabits<Array<{ id: string; epic_id: string; habit_id: string }>[number]>([epicId]);
      const match = existing.find((row) => row.habit_id === habitId);
      if (match) {
        await removePlannerRecord("epic_habits", match.id);
      }

      const { error } = await supabase
        .from("epic_habits")
        .delete()
        .eq("epic_id", epicId)
        .eq("habit_id", habitId);

      if (error) {
        console.error("Failed to remove habit from epic:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast("Habit removed from epic");
    },
    onError: (error) => {
      console.error("Failed to remove habit:", error);
      toast.error("Failed to remove habit from epic");
    },
  });

  const activeEpics = epics.filter((epic) => epic.status === "active");
  const completedEpics = epics.filter((epic) => epic.status === "completed");

  return {
    epics,
    activeEpics,
    completedEpics,
    isLoading: epicsQuery.isLoading && epics.length === 0,
    error: epicsQuery.error,
    createEpic: createEpic.mutateAsync,
    isCreating: createEpic.isPending,
    isCreateSuccess: createEpic.isSuccess,
    updateEpicStatus: updateEpicStatus.mutate,
    addHabitToEpic: addHabitToEpic.mutate,
    removeHabitFromEpic: removeHabitFromEpic.mutate,
  };
};
