import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/components/ui/sonner";
import { ECHO_MAP, AttributeType } from "@/config/attributeDescriptions";
import { useAchievements } from "./useAchievements";

const STAT_MIN = 100;
const STAT_MAX = 1000;
const STAT_DEFAULT = 300;

type DisciplineSourceEvent =
  | "habit_complete"
  | "planned_task_on_time"
  | "streak_milestone";

type WisdomSourceEvent = "habit_complete_learning";
type AlignmentSourceEvent = "morning_check_in" | "evening_reflection";
type CompanionAttributeSourceEvent =
  | DisciplineSourceEvent
  | WisdomSourceEvent
  | AlignmentSourceEvent;

interface UpdateAttributeParams {
  companionId: string;
  attribute: AttributeType;
  amount: number;
  applyEchoGains?: boolean;
}

interface AwardCompanionAttributeParams {
  attribute: AttributeType;
  sourceEvent: CompanionAttributeSourceEvent;
  sourceKey: string;
  amount: number;
  applyEchoGains?: boolean;
}

interface AwardCompanionAttributeResult {
  awardedAmount: number;
  attributeBefore: number;
  attributeAfter: number;
  capApplied: boolean;
  wasDuplicate: boolean;
  echoAmount: number;
}

interface AwardCompanionAttributeRpcRow {
  awarded_amount: number;
  attribute_before: number;
  attribute_after: number;
  cap_applied: boolean;
  was_duplicate: boolean;
  echo_amount: number;
}

interface StreakMilestoneParams {
  companionId: string;
  streakDays: number;
  date?: string;
}

interface HabitDisciplineAwardParams {
  companionId: string;
  habitId: string;
  date: string;
}

interface PlannedTaskDisciplineAwardParams {
  companionId: string;
  taskId: string;
}

interface HabitLearningWisdomAwardParams {
  companionId: string;
  habitId: string;
  date: string;
}

interface AlignmentAwardParams {
  companionId: string;
  date?: string;
}

interface CompanionBadgeStatSnapshot {
  vitality: number | null;
  wisdom: number | null;
  discipline: number | null;
  resolve: number | null;
  creativity: number | null;
  alignment: number | null;
}

const getLocalDateStamp = () => new Date().toLocaleDateString("en-CA");

const normalizeDetailedStat = (value: number | null | undefined) => {
  return Math.max(STAT_MIN, value ?? STAT_DEFAULT);
};

export const deriveBadgeAttributes = ({
  vitality,
  wisdom,
  discipline,
  resolve,
  creativity,
  alignment,
}: CompanionBadgeStatSnapshot) => {
  const mind = Math.floor(
    (normalizeDetailedStat(wisdom) + normalizeDetailedStat(creativity)) / 12,
  );
  const body = Math.floor(
    (normalizeDetailedStat(vitality) + normalizeDetailedStat(discipline)) / 12,
  );
  const soul = Math.floor(
    (normalizeDetailedStat(resolve) + normalizeDetailedStat(alignment)) / 12,
  );

  return {
    mind,
    body,
    soul,
    total: mind + body + soul,
  };
};

export const getStreakDisciplineGain = (streakDays: number): number => {
  if (streakDays === 7) return 15;
  if (streakDays === 14) return 25;
  if (streakDays === 30) return 40;
  if (streakDays > 0 && streakDays % 7 === 0) return 5;
  return 0;
};

export const useCompanionAttributes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { checkAttributeAchievements, checkTotalAttributesAchievement } = useAchievements();

  const syncDerivedAttributeAchievements = useCallback(async (companionId: string) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("user_companion")
      .select("vitality, wisdom, discipline, resolve, creativity, alignment")
      .eq("id", companionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) return;

    const badgeStats = deriveBadgeAttributes(data);

    await Promise.all([
      checkAttributeAchievements("mind", badgeStats.mind),
      checkAttributeAchievements("body", badgeStats.body),
      checkAttributeAchievements("soul", badgeStats.soul),
    ]);

    await checkTotalAttributesAchievement(badgeStats.total);
  }, [checkAttributeAchievements, checkTotalAttributesAchievement, user?.id]);

  const updateAttribute = useMutation({
    mutationFn: async ({ companionId, attribute, amount, applyEchoGains = true }: UpdateAttributeParams) => {
      if (!user) throw new Error("Not authenticated");

      const { data: companion, error: fetchError } = await supabase
        .from("user_companion")
        .select("vitality, wisdom, discipline, resolve, creativity, alignment")
        .eq("id", companionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!companion) throw new Error("Companion not found");

      const currentValue = companion[attribute] ?? STAT_DEFAULT;
      const newValue = Math.max(STAT_MIN, Math.min(STAT_MAX, currentValue + amount));

      const updates: Record<string, number | string> = {
        [attribute]: newValue,
        last_energy_update: new Date().toISOString(),
      };

      if (applyEchoGains && amount > 0) {
        const echoStats = ECHO_MAP[attribute] || [];
        const echoAmount = Math.min(20, Math.floor(amount * 0.2));

        if (echoAmount > 0) {
          for (const echoStat of echoStats) {
            const echoCurrentValue = companion[echoStat] ?? STAT_DEFAULT;
            updates[echoStat] = Math.min(STAT_MAX, Math.max(STAT_MIN, echoCurrentValue + echoAmount));
          }
        }
      }

      const { error: updateError } = await supabase
        .from("user_companion")
        .update(updates)
        .eq("id", companionId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return { attribute, newValue, change: amount, companionId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });

      if (Math.abs(data.change) >= 50) {
        const emoji = data.change > 0 ? "⬆️" : "⬇️";
        const direction = data.change > 0 ? "increased" : "decreased";
        const attrInfo = ATTRIBUTE_DESCRIPTIONS_SIMPLE[data.attribute];
        toast.success(`${emoji} ${attrInfo?.name || data.attribute} ${direction}!`, {
          duration: 2000,
        });
      }

      void syncDerivedAttributeAchievements(data.companionId).catch((error) => {
        console.error("Attribute badge sync failed:", error);
      });
    },
    onError: (error) => {
      console.error("Attribute update failed:", error);
    },
  });

  const awardCompanionAttribute = useMutation({
    mutationFn: async ({
      attribute,
      sourceEvent,
      sourceKey,
      amount,
      applyEchoGains = true,
    }: AwardCompanionAttributeParams): Promise<AwardCompanionAttributeResult> => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase.rpc("award_companion_attribute", {
        p_attribute: attribute,
        p_source_event: sourceEvent,
        p_source_key: sourceKey,
        p_amount: amount,
        p_apply_echo_gains: applyEchoGains,
      });

      if (error) throw error;

      const result = (Array.isArray(data) ? data[0] : data) as AwardCompanionAttributeRpcRow | null;
      if (!result) throw new Error("Attribute award returned no data");

      return {
        awardedAmount: result.awarded_amount ?? 0,
        attributeBefore: result.attribute_before ?? STAT_DEFAULT,
        attributeAfter: result.attribute_after ?? STAT_DEFAULT,
        capApplied: Boolean(result.cap_applied),
        wasDuplicate: Boolean(result.was_duplicate),
        echoAmount: result.echo_amount ?? 0,
      };
    },
    onSuccess: (data, variables) => {
      if (data.awardedAmount > 0) {
        queryClient.invalidateQueries({ queryKey: ["companion"] });
        void syncDerivedAttributeAchievements(variables.companionId).catch((error) => {
          console.error("Attribute badge sync failed:", error);
        });
      }
    },
    onError: (error) => {
      console.error("Companion attribute award failed:", error);
    },
  });

  const updateVitalityFromFitness = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: "vitality", amount: 12 });
    },
  });

  const updateWisdomFromLearning = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: "wisdom", amount: 8 });
    },
  });

  const updateDisciplineFromWork = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: "discipline", amount: 10 });
    },
  });

  const updateResolveFromResist = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: "resolve", amount: 20 });
    },
  });

  const updateCreativityFromShipping = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: "creativity", amount: 10 });
    },
  });

  const updateAlignmentFromReflection = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({
        companionId,
        attribute: "alignment",
        amount: 6,
      });
    },
  });

  const awardDisciplineForHabitCompletion = useMutation({
    mutationFn: async ({ companionId: _companionId, habitId, date }: HabitDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      return awardCompanionAttribute.mutateAsync({
        attribute: "discipline",
        sourceEvent: "habit_complete",
        sourceKey: `habit_complete:${habitId}:${date}`,
        amount: 4,
        applyEchoGains: true,
      });
    },
  });

  const awardDisciplineForPlannedTaskOnTime = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      return awardCompanionAttribute.mutateAsync({
        attribute: "discipline",
        sourceEvent: "planned_task_on_time",
        sourceKey: `planned_task_on_time:${taskId}`,
        amount: 2,
        applyEchoGains: true,
      });
    },
  });

  const awardWisdomForHabitLearning = useMutation({
    mutationFn: async ({ companionId: _companionId, habitId, date }: HabitLearningWisdomAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      return awardCompanionAttribute.mutateAsync({
        attribute: "wisdom",
        sourceEvent: "habit_complete_learning",
        sourceKey: `habit_complete_learning:${habitId}:${date}`,
        amount: 8,
        applyEchoGains: false,
      });
    },
  });

  const awardAlignmentForMorningCheckIn = useMutation({
    mutationFn: async ({ companionId: _companionId, date }: AlignmentAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      return awardCompanionAttribute.mutateAsync({
        attribute: "alignment",
        sourceEvent: "morning_check_in",
        sourceKey: `morning_check_in:${date ?? getLocalDateStamp()}`,
        amount: 6,
        applyEchoGains: false,
      });
    },
  });

  const awardAlignmentForEveningReflection = useMutation({
    mutationFn: async ({ companionId: _companionId, date }: AlignmentAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      return awardCompanionAttribute.mutateAsync({
        attribute: "alignment",
        sourceEvent: "evening_reflection",
        sourceKey: `evening_reflection:${date ?? getLocalDateStamp()}`,
        amount: 6,
        applyEchoGains: false,
      });
    },
  });

  const updateFromStreakMilestone = useMutation({
    mutationFn: async ({ companionId: _companionId, streakDays, date }: StreakMilestoneParams) => {
      if (!user) throw new Error("Not authenticated");

      const disciplineGain = getStreakDisciplineGain(streakDays);
      if (disciplineGain <= 0) {
        return null;
      }

      return awardCompanionAttribute.mutateAsync({
        attribute: "discipline",
        sourceEvent: "streak_milestone",
        sourceKey: `streak_milestone:${streakDays}:${date ?? getLocalDateStamp()}`,
        amount: disciplineGain,
        applyEchoGains: true,
      });
    },
  });

  const updateFromPerfectDay = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({
        companionId,
        attribute: "alignment",
        amount: 8,
        applyEchoGains: true,
      });
    },
  });

  const decayStats = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data: companion, error: fetchError } = await supabase
        .from("user_companion")
        .select("vitality, wisdom, discipline, resolve, creativity, alignment")
        .eq("id", companionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!companion) throw new Error("Companion not found");

      const decayAmounts: Record<string, number> = {
        discipline: 40,
        vitality: 30,
        creativity: 25,
        resolve: 20,
        wisdom: 15,
        alignment: 15,
      };

      const updates: Record<string, number | string> = {
        last_energy_update: new Date().toISOString(),
      };

      for (const [stat, decayAmount] of Object.entries(decayAmounts)) {
        const currentValue = (companion as Record<string, number>)[stat] ?? STAT_DEFAULT;
        updates[stat] = Math.max(STAT_MIN, currentValue - decayAmount);
      }

      const { error: updateError } = await supabase
        .from("user_companion")
        .update(updates)
        .eq("id", companionId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;
    },
  });

  return {
    awardCompanionAttribute: awardCompanionAttribute.mutateAsync,
    updateAttribute: updateAttribute.mutateAsync,
    updateVitalityFromFitness: updateVitalityFromFitness.mutateAsync,
    updateWisdomFromLearning: updateWisdomFromLearning.mutateAsync,
    updateDisciplineFromWork: updateDisciplineFromWork.mutateAsync,
    awardDisciplineForHabitCompletion: awardDisciplineForHabitCompletion.mutateAsync,
    awardDisciplineForPlannedTaskOnTime: awardDisciplineForPlannedTaskOnTime.mutateAsync,
    awardWisdomForHabitLearning: awardWisdomForHabitLearning.mutateAsync,
    awardAlignmentForMorningCheckIn: awardAlignmentForMorningCheckIn.mutateAsync,
    awardAlignmentForEveningReflection: awardAlignmentForEveningReflection.mutateAsync,
    updateResolveFromResist: updateResolveFromResist.mutateAsync,
    updateCreativityFromShipping: updateCreativityFromShipping.mutateAsync,
    updateAlignmentFromReflection: updateAlignmentFromReflection.mutateAsync,
    updateFromStreakMilestone: updateFromStreakMilestone.mutateAsync,
    updateFromPerfectDay: updateFromPerfectDay.mutateAsync,
    decayStats: decayStats.mutateAsync,
  };
};

const ATTRIBUTE_DESCRIPTIONS_SIMPLE: Record<AttributeType, { name: string }> = {
  vitality: { name: "Vitality" },
  wisdom: { name: "Wisdom" },
  discipline: { name: "Discipline" },
  resolve: { name: "Resolve" },
  creativity: { name: "Creativity" },
  alignment: { name: "Alignment" },
};

export type {
  AlignmentSourceEvent,
  AttributeType,
  AwardCompanionAttributeResult,
  CompanionAttributeSourceEvent,
  DisciplineSourceEvent,
  WisdomSourceEvent,
};
