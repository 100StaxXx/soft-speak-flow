import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";

import { useXPToast } from "@/contexts/XPContext";
import {
  getDailyFormationPracticeById,
  type DailyFormationCategory,
  type DailyFormationFocus,
  type DailyFormationPractice,
} from "@/data/dailyFormationPractices";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";
import { supabase } from "@/integrations/supabase/client";
import {
  selectAdaptiveDailyFormation,
  type FormationAssignmentHistory,
  type FormationReflectionSignal,
} from "@/lib/adaptiveDailyFormation";
import { getEffectiveDailyDate } from "@/utils/timezone";
import { PRODUCT_RUNTIME } from "@/config/productRuntime";

export const DAILY_FORMATION_QUERY_KEY = "daily-formation";
export const FORMATION_PROGRESS_QUERY_KEY = "formation-progress";

export interface FormationProgressSnapshot {
  totalXp: number;
  practicesCompleted: number;
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
}

export interface DailyFormationAssignment {
  assignmentId: string | null;
  taskId: string | null;
  practiceDate: string;
  practice: DailyFormationPractice;
  selectionReason: string;
  completedAt: string | null;
  progress: FormationProgressSnapshot;
  isLocalFallback: boolean;
}

interface PreparedFormationRow {
  action: string;
  assignment_id: string;
  benefit: string;
  category: string;
  focus?: string | null;
  practice_source?: string | null;
  completed_at: string | null;
  minutes: number;
  practice_date: string;
  practice_key: string;
  practices_completed: number;
  selection_reason: string;
  scripture_reference?: string | null;
  task_id: string | null;
  title: string;
  total_xp: number;
  xp_reward: number;
}

interface FormationCompletionRow {
  assignment_id: string;
  completed_at: string;
  level_after: number;
  practices_completed: number;
  status: string;
  task_id: string | null;
  total_xp: number;
  xp_awarded: number;
  xp_into_level: number;
  xp_to_next_level: number;
}

const FALLBACK_FORMATION_METADATA: Record<
  DailyFormationCategory,
  Pick<DailyFormationPractice, "focus" | "mode" | "root">
> = {
  Mind: { focus: "knowledge", mode: "Reflective", root: "learning" },
  Body: { focus: "exercise", mode: "Bodily", root: "movement" },
  Soul: { focus: "faith", mode: "Inward", root: "prayer" },
};

const progressFromTotals = (totalXp = 0, practicesCompleted = 0): FormationProgressSnapshot => ({
  totalXp,
  practicesCompleted,
  level: Math.floor(totalXp / 100) + 1,
  xpIntoLevel: totalXp % 100,
  xpToNextLevel: 100 - (totalXp % 100),
});

const isDailyFormationCategory = (value: string): value is DailyFormationCategory =>
  value === "Mind" || value === "Body" || value === "Soul";

const isCompatibleFocus = (
  category: DailyFormationCategory,
  value: string | null | undefined,
): value is DailyFormationFocus => (
  (category === "Mind" && value === "knowledge")
  || (category === "Body" && (value === "exercise" || value === "nutrition"))
  || (category === "Soul" && (value === "scripture" || value === "faith"))
);

const assignmentFromRow = (
  row: PreparedFormationRow,
  expectedCategory: DailyFormationCategory,
): DailyFormationAssignment => {
  if (!isDailyFormationCategory(row.category) || row.category !== expectedCategory) {
    throw new Error(`Received a ${row.category || "missing"} assignment for the ${expectedCategory} pillar`);
  }

  const category = row.category;
  const reviewedPractice = getDailyFormationPracticeById(row.practice_key);
  if (reviewedPractice && reviewedPractice.category !== category) {
    throw new Error(`Received ${reviewedPractice.title} in the wrong formation pillar`);
  }
  const generatedFocus = isCompatibleFocus(category, row.focus)
    ? row.focus
    : FALLBACK_FORMATION_METADATA[category].focus;
  const metadata = reviewedPractice ?? {
    focus: generatedFocus,
    mode: category === "Body" ? "Bodily" as const : "Reflective" as const,
    root: generatedFocus === "nutrition"
      ? "nutrition" as const
      : generatedFocus === "exercise"
        ? "movement" as const
        : generatedFocus === "scripture"
          ? "Scripture" as const
          : generatedFocus === "knowledge"
            ? "learning" as const
            : "prayer" as const,
  };

  return {
    assignmentId: row.assignment_id,
    taskId: row.task_id,
    practiceDate: row.practice_date,
    practice: {
      id: row.practice_key,
      source: row.practice_source === "generated" ? "generated" : "reviewed",
      category,
      focus: metadata.focus,
      mode: metadata.mode,
      root: metadata.root,
      title: row.title,
      action: row.action,
      benefit: row.benefit,
      minutes: row.minutes,
      xpReward: row.xp_reward,
      scriptureReference: row.scripture_reference ?? null,
    },
    selectionReason: row.selection_reason,
    completedAt: row.completed_at,
    progress: progressFromTotals(row.total_xp, row.practices_completed),
    isLocalFallback: false,
  };
};

const preparePractice = async (
  dateKey: string,
  selection: ReturnType<typeof selectAdaptiveDailyFormation>,
): Promise<DailyFormationAssignment> => {
  const { practice, reason } = selection;
  const { data, error } = await supabase.rpc("prepare_daily_formation_practice", {
    p_practice_date: dateKey,
    p_practice_key: practice.id,
    p_category: practice.category,
    p_title: practice.title,
    p_action: practice.action,
    p_benefit: practice.benefit,
    p_minutes: practice.minutes,
    p_selection_reason: reason,
  }).single();

  if (error) throw error;
  return assignmentFromRow(data as PreparedFormationRow, practice.category);
};

export function useAdaptiveDailyFormation({
  enabled = true,
  category = "Soul",
}: {
  enabled?: boolean;
  category?: DailyFormationCategory;
} = {}) {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const { toast } = useToast();
  const { showXPToast } = useXPToast();
  const { awardCustomXP } = useXPRewards();
  const queryClient = useQueryClient();
  const dateKey = getEffectiveDailyDate(profile?.timezone ?? undefined);
  const effectiveDateAtNoon = new Date(`${dateKey}T12:00:00`);
  const reviewedFallback = selectAdaptiveDailyFormation({
    dateKey,
    userId: user?.id ?? `${PRODUCT_RUNTIME.authProductMode}-preview`,
    path: profile?.faction === "starfall" || profile?.faction === "void" || profile?.faction === "stellar"
      ? profile.faction
      : null,
    focusCategory: category,
  });

  const query = useQuery({
    queryKey: [DAILY_FORMATION_QUERY_KEY, user?.id, dateKey, profile?.faction ?? "no-path", category],
    enabled: enabled && Boolean(user?.id) && !profileLoading,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<DailyFormationAssignment> => {
      if (!user?.id) throw new Error("User not authenticated");

      const path = profile?.faction === "starfall" || profile?.faction === "void" || profile?.faction === "stellar"
        ? profile.faction
        : null;
      const localSelection = selectAdaptiveDailyFormation({
        dateKey,
        userId: user.id,
        path,
        focusCategory: category,
      });
      const localFallback: DailyFormationAssignment = {
        assignmentId: null,
        taskId: null,
        practiceDate: dateKey,
        practice: localSelection.practice,
        selectionReason: localSelection.reason,
        completedAt: null,
        progress: progressFromTotals(),
        isLocalFallback: true,
      };

      try {
        const { data: existing, error: existingError } = await supabase
          .from("daily_formation_assignments")
          .select("id, practice_date, practice_key, category, focus, practice_source, title, action, benefit, minutes, xp_reward, selection_reason, scripture_reference, task_id, completed_at")
          .eq("user_id", user.id)
          .eq("practice_date", dateKey)
          .eq("category", category)
          .maybeSingle();
        if (existingError) throw existingError;

        if (existing) {
          const { data: progress } = await supabase
            .from("formation_progress")
            .select("total_xp, practices_completed")
            .eq("user_id", user.id)
            .maybeSingle();
          return assignmentFromRow({
            action: existing.action,
            assignment_id: existing.id,
            benefit: existing.benefit,
            category: existing.category,
            focus: existing.focus,
            practice_source: existing.practice_source,
            completed_at: existing.completed_at,
            minutes: existing.minutes,
            practice_date: existing.practice_date,
            practice_key: existing.practice_key,
            practices_completed: progress?.practices_completed ?? 0,
            selection_reason: existing.selection_reason,
            scripture_reference: existing.scripture_reference,
            task_id: existing.task_id,
            title: existing.title,
            total_xp: progress?.total_xp ?? 0,
            xp_reward: existing.xp_reward,
          }, category);
        }

        const historyStart = format(subDays(effectiveDateAtNoon, 45), "yyyy-MM-dd");
        const [historyResult, learningResult, reflectionsResult] = await Promise.all([
          supabase
            .from("daily_formation_assignments")
            .select("practice_key, practice_date, category, completed_at")
            .eq("user_id", user.id)
            .gte("practice_date", historyStart)
            .order("practice_date", { ascending: false })
            .limit(45),
          supabase
            .from("user_ai_learning")
            .select("successful_patterns, overwhelm_signals")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("evening_reflections")
            .select("mood, gratitude, wins, additional_reflection, tomorrow_adjustment")
            .eq("user_id", user.id)
            .gte("reflection_date", format(subDays(effectiveDateAtNoon, 7), "yyyy-MM-dd"))
            .order("reflection_date", { ascending: false })
            .limit(7),
        ]);

        const history: FormationAssignmentHistory[] = (historyResult.data ?? []).map((item) => ({
          practiceKey: item.practice_key,
          practiceDate: item.practice_date,
          category: item.category as DailyFormationCategory,
          completedAt: item.completed_at,
        }));
        const selection = selectAdaptiveDailyFormation({
          dateKey,
          userId: user.id,
          history,
          learning: {
            overwhelmSignals: learningResult.data?.overwhelm_signals,
            successfulPatterns: learningResult.data?.successful_patterns,
          },
          reflections: (reflectionsResult.data ?? []) as FormationReflectionSignal[],
          path,
          focusCategory: category,
        });

        try {
          const { data: generated, error: generationError } = await supabase.functions.invoke(
            "generate-daily-formation",
            { body: { practiceDate: dateKey, category } },
          );
          if (generationError) throw generationError;
          if (generated?.assignment) {
            return assignmentFromRow(generated.assignment as PreparedFormationRow, category);
          }
        } catch (generationError) {
          console.warn("Personalized formation was unavailable; using the reviewed library:", generationError);
        }

        return await preparePractice(dateKey, selection);
      } catch (error) {
        console.warn("Daily formation is using its reviewed offline selection until sync returns:", error);
        return localFallback;
      }
    },
  });

  const completionMutation = useMutation({
    mutationFn: async (): Promise<FormationCompletionRow> => {
      if (!user?.id) throw new Error("User not authenticated");
      const current = query.data;
      if (!current) throw new Error("Today's practice is still being prepared");

      const prepared = current.assignmentId
        ? current
        : await preparePractice(dateKey, {
          practice: current.practice,
          reason: current.selectionReason,
        });
      if (!prepared.assignmentId) throw new Error("Today's practice could not be prepared");

      const { data, error } = await supabase.rpc("complete_daily_formation_practice", {
        p_assignment_id: prepared.assignmentId,
      }).single();
      if (error) throw error;
      return data as FormationCompletionRow;
    },
    onSuccess: async (result) => {
      let companionXPAwarded = 0;
      if (result.task_id && result.completed_at) {
        try {
          const awardResult = await awardCustomXP(
            query.data?.practice.xpReward ?? result.xp_awarded,
            "task_complete",
            undefined,
            {
              task_id: result.task_id,
              task_date: dateKey,
              source: "faithful_step",
              assignment_id: result.assignment_id,
            },
            `faithful-step:${result.assignment_id}:${result.completed_at}`,
          );
          companionXPAwarded = awardResult?.xpAwarded ?? 0;
        } catch (xpError) {
          console.warn("Faithful Step companion XP will retry on reconciliation:", xpError);
        }
      }

      if (companionXPAwarded > 0) {
        showXPToast(companionXPAwarded, "Faithful practice complete");
      }

      if (result.xp_awarded > 0) {
        void supabase.functions.invoke("analyze-user-patterns", {
          body: {
            type: "formation_practice_completion",
            data: {
              assignmentId: result.assignment_id,
              taskId: result.task_id,
              practiceKey: query.data?.practice.id,
              category: query.data?.practice.category,
              completedAt: result.completed_at,
              completionHour: new Date().getHours(),
              dayOfWeek: new Date().getDay(),
            },
          },
        }).then(({ error }) => {
          if (error) console.warn("Formation learning signal was not saved:", error);
        });
      }

      queryClient.setQueryData<DailyFormationAssignment>(
        [DAILY_FORMATION_QUERY_KEY, user?.id, dateKey, profile?.faction ?? "no-path", category],
        (current) => current ? {
          ...current,
          assignmentId: result.assignment_id,
          taskId: result.task_id,
          completedAt: result.completed_at,
          isLocalFallback: false,
          progress: {
            totalXp: result.total_xp,
            practicesCompleted: result.practices_completed,
            level: result.level_after,
            xpIntoLevel: result.xp_into_level,
            xpToNextLevel: result.xp_to_next_level,
          },
        } : current,
      );
      void queryClient.invalidateQueries({ queryKey: [FORMATION_PROGRESS_QUERY_KEY, user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["companion", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["daily-tasks", user?.id] });
      window.dispatchEvent(new CustomEvent("action-completed", {
        detail: { taskId: result.task_id, source: "faithful_step" },
      }));
    },
    onError: (error) => {
      console.error("Faithful Step completion could not be saved:", error);
      toast({
        title: "Couldn’t save your Faithful Step",
        description: "Your step was not saved. Please try again in a moment.",
        variant: "destructive",
      });
    },
  });

  const alignmentMutation = useMutation({
    mutationFn: async ({
      category,
      focusLabel,
      guideName,
      source = "guide",
    }: {
      category: DailyFormationCategory;
      focusLabel: string;
      guideName: string;
      source?: "guide" | "companion";
    }): Promise<DailyFormationAssignment> => {
      if (!user?.id) throw new Error("User not authenticated");
      const current = query.data;
      if (!current) {
        const selection = selectAdaptiveDailyFormation({
          dateKey,
          userId: user.id,
          focusCategory: category,
        });
        const localAssignment: DailyFormationAssignment = {
          assignmentId: null,
          taskId: null,
          practiceDate: dateKey,
          practice: selection.practice,
          selectionReason: source === "companion"
            ? `Chosen with ${guideName} · ${focusLabel}`
            : `Connected to ${guideName}'s question: ${focusLabel}`,
          completedAt: null,
          progress: progressFromTotals(),
          isLocalFallback: true,
        };

        try {
          return await preparePractice(dateKey, {
            practice: selection.practice,
            reason: localAssignment.selectionReason,
          });
        } catch (error) {
          console.warn("Faithful Step is using its local Guide alignment until sync returns:", error);
          return localAssignment;
        }
      }
      if (current.completedAt) {
        return current;
      }

      const historyStart = format(subDays(effectiveDateAtNoon, 45), "yyyy-MM-dd");
      const { data: historyRows, error: historyError } = await supabase
        .from("daily_formation_assignments")
        .select("practice_key, practice_date, category, completed_at")
        .eq("user_id", user.id)
        .gte("practice_date", historyStart)
        .neq("practice_date", dateKey)
        .order("practice_date", { ascending: false })
        .limit(45);

      if (historyError) {
        console.warn("Guide-aligned practice history was unavailable:", historyError);
      }

      const path = profile?.faction === "starfall" || profile?.faction === "void" || profile?.faction === "stellar"
        ? profile.faction
        : null;
      const selection = selectAdaptiveDailyFormation({
        dateKey,
        userId: user.id,
        history: (historyRows ?? []).map((item) => ({
          practiceKey: item.practice_key,
          practiceDate: item.practice_date,
          category: item.category as DailyFormationCategory,
          completedAt: item.completed_at,
        })),
        path,
        focusCategory: category,
      });
      const selectionReason = source === "companion"
        ? `Chosen with ${guideName} · ${focusLabel}`
        : `Connected to ${guideName}'s question: ${focusLabel}`;
      const locallyAligned: DailyFormationAssignment = {
        ...current,
        practice: selection.practice,
        selectionReason,
      };

      try {
        const prepared = current.assignmentId
          ? current
          : await preparePractice(dateKey, {
            practice: current.practice,
            reason: current.selectionReason,
          });
        if (!prepared.assignmentId) return locallyAligned;

        const { data, error } = await supabase.rpc("align_daily_formation_practice", {
          p_assignment_id: prepared.assignmentId,
          p_practice_key: selection.practice.id,
          p_category: selection.practice.category,
          p_title: selection.practice.title,
          p_action: selection.practice.action,
          p_benefit: selection.practice.benefit,
          p_minutes: selection.practice.minutes,
          p_selection_reason: selectionReason,
        }).single();
        if (error) throw error;
        return assignmentFromRow(data as PreparedFormationRow, category);
      } catch (error) {
        console.warn("Faithful Step is using its local Guide alignment until sync returns:", error);
        return locallyAligned;
      }
    },
    onSuccess: (assignment) => {
      queryClient.setQueryData<DailyFormationAssignment>(
        [DAILY_FORMATION_QUERY_KEY, user?.id, dateKey, profile?.faction ?? "no-path", category],
        assignment,
      );
      void queryClient.invalidateQueries({ queryKey: ["daily-tasks", user?.id] });
    },
  });

  return {
    assignment: query.data ?? null,
    practice: query.data?.practice ?? reviewedFallback.practice,
    progress: query.data?.progress ?? progressFromTotals(),
    isLoading: query.isLoading,
    isCompleting: completionMutation.isPending,
    isAligning: alignmentMutation.isPending,
    error: query.error,
    completePractice: completionMutation.mutateAsync,
    alignPracticeWithFocus: alignmentMutation.mutateAsync,
  };
}

export function useFormationProgress() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: [FORMATION_PROGRESS_QUERY_KEY, user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { data, error } = await supabase
        .from("formation_progress")
        .select("total_xp, practices_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return progressFromTotals(data?.total_xp ?? 0, data?.practices_completed ?? 0);
    },
  });

  return {
    progress: query.data ?? progressFromTotals(),
    isLoading: query.isLoading,
    error: query.error,
  };
}
