import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "@/components/ui/sonner";
import { ECHO_MAP, AttributeType } from "@/config/attributeDescriptions";
import { useAchievements } from "./useAchievements";
import {
  COMPANION_ATTRIBUTE_EVENT_CONFIG,
  type CompanionAttributeSourceEvent,
  getCompanionBehaviorAwardIntent,
  shouldAwardHardTaskResolve,
} from "@/shared/companionStatSignals";

const STAT_MIN = 100;
const STAT_MAX = 1000;
const STAT_DEFAULT = 300;

interface UpdateAttributeParams {
  companionId: string;
  attribute: AttributeType;
  amount: number;
  applyEchoGains?: boolean;
}

interface AwardCompanionAttributeParams {
  companionId?: string;
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

interface BehaviorStatAwardParams {
  companionId: string;
  source: "task" | "habit";
  sourceId: string;
  title: string;
  date?: string | null;
  category?: string | null;
  difficulty?: string | null;
  priority?: string | null;
  epicTitle?: string | null;
  contactId?: string | null;
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

const buildCompanionSourceKey = (
  sourceEvent: CompanionAttributeSourceEvent,
  sourceId: string,
  date?: string | null,
) => {
  if (sourceEvent === "morning_check_in" || sourceEvent === "evening_reflection") {
    return `${sourceEvent}:${date ?? getLocalDateStamp()}`;
  }

  if (
    sourceEvent === "habit_complete"
    || sourceEvent === "habit_complete_learning"
    || sourceEvent === "streak_milestone"
  ) {
    return `${sourceEvent}:${sourceId}:${date ?? getLocalDateStamp()}`;
  }

  return `${sourceEvent}:${sourceId}`;
};

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
        if (variables.companionId) {
          void syncDerivedAttributeAchievements(variables.companionId).catch((error) => {
            console.error("Attribute badge sync failed:", error);
          });
        }
      }
    },
    onError: (error) => {
      console.error("Companion attribute award failed:", error);
    },
  });

  const awardBehaviorStat = useMutation({
    mutationFn: async ({
      companionId: _companionId,
      source,
      sourceId,
      title,
      date,
      category,
      difficulty,
      priority,
      epicTitle,
      contactId,
    }: BehaviorStatAwardParams) => {
      if (!user) throw new Error("Not authenticated");

      const results: AwardCompanionAttributeResult[] = [];
      const intent = getCompanionBehaviorAwardIntent({
        title,
        category,
        difficulty,
        priority,
        epicTitle,
        contactId,
      });

      if (intent) {
        results.push(await awardCompanionAttribute.mutateAsync({
          attribute: intent.attribute as AttributeType,
          sourceEvent: intent.sourceEvent,
          sourceKey: buildCompanionSourceKey(intent.sourceEvent, sourceId, date),
          amount: intent.amount,
          applyEchoGains: intent.applyEchoGains,
        }));
      }

      if (
        source === "task"
        && shouldAwardHardTaskResolve({ difficulty, priority })
        && intent?.sourceEvent !== "hard_task_complete"
      ) {
        const hardTaskIntent = COMPANION_ATTRIBUTE_EVENT_CONFIG.hard_task_complete;
        results.push(await awardCompanionAttribute.mutateAsync({
          attribute: hardTaskIntent.attribute,
          sourceEvent: hardTaskIntent.sourceEvent,
          sourceKey: buildCompanionSourceKey(hardTaskIntent.sourceEvent, sourceId, date),
          amount: hardTaskIntent.amount,
          applyEchoGains: hardTaskIntent.applyEchoGains,
        }));
      }

      return results;
    },
  });

  const updateVitalityFromFitness = useMutation({
    mutationFn: async (_companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.health_task_complete;
      await awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "manual_fitness", getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const updateWisdomFromLearning = useMutation({
    mutationFn: async (_companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.habit_complete_learning;
      await awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "manual_learning", getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const updateDisciplineFromWork = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: "discipline", amount: 10 });
    },
  });

  const updateResolveFromResist = useMutation({
    mutationFn: async (_companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.urge_resist;
      await awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "manual_resist", getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const updateCreativityFromShipping = useMutation({
    mutationFn: async (_companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.creative_block_complete;
      await awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "manual_creative", getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const updateAlignmentFromReflection = useMutation({
    mutationFn: async (_companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.evening_reflection;
      await awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "manual_reflection", getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardDisciplineForHabitCompletion = useMutation({
    mutationFn: async ({ companionId: _companionId, habitId, date }: HabitDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.habit_complete;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, habitId, date),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardDisciplineForPlannedTaskOnTime = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.planned_task_on_time;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardWisdomForHabitLearning = useMutation({
    mutationFn: async ({ companionId: _companionId, habitId, date }: HabitLearningWisdomAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.habit_complete_learning;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, habitId, date),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardAlignmentForMorningCheckIn = useMutation({
    mutationFn: async ({ companionId: _companionId, date }: AlignmentAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.morning_check_in;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "morning", date ?? getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardAlignmentForEveningReflection = useMutation({
    mutationFn: async ({ companionId: _companionId, date }: AlignmentAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.evening_reflection;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "evening", date ?? getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardVitalityForHealthTask = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.health_task_complete;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardVitalityForRecoveryBlock = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.recovery_block_kept;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardResolveForHardTask = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.hard_task_complete;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardResolveForBounceBackDay = useMutation({
    mutationFn: async ({ companionId: _companionId, date }: AlignmentAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.bounce_back_day;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, "bounce_back", date ?? getLocalDateStamp()),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardResolveForUrgeResist = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.urge_resist;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardCreativityForCreativeBlock = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.creative_block_complete;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardAlignmentForEpicProgress = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.epic_progress_complete;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
      });
    },
  });

  const awardAlignmentForRelationshipMaintenance = useMutation({
    mutationFn: async ({ companionId: _companionId, taskId }: PlannedTaskDisciplineAwardParams) => {
      if (!user) throw new Error("Not authenticated");
      const config = COMPANION_ATTRIBUTE_EVENT_CONFIG.relationship_maintenance_complete;
      return awardCompanionAttribute.mutateAsync({
        attribute: config.attribute,
        sourceEvent: config.sourceEvent,
        sourceKey: buildCompanionSourceKey(config.sourceEvent, taskId),
        amount: config.amount,
        applyEchoGains: config.applyEchoGains,
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
        sourceKey: buildCompanionSourceKey("streak_milestone", String(streakDays), date ?? getLocalDateStamp()),
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
    awardBehaviorStat: awardBehaviorStat.mutateAsync,
    awardAlignmentForMorningCheckIn: awardAlignmentForMorningCheckIn.mutateAsync,
    awardAlignmentForEveningReflection: awardAlignmentForEveningReflection.mutateAsync,
    awardVitalityForHealthTask: awardVitalityForHealthTask.mutateAsync,
    awardVitalityForRecoveryBlock: awardVitalityForRecoveryBlock.mutateAsync,
    awardResolveForHardTask: awardResolveForHardTask.mutateAsync,
    awardResolveForBounceBackDay: awardResolveForBounceBackDay.mutateAsync,
    awardResolveForUrgeResist: awardResolveForUrgeResist.mutateAsync,
    awardCreativityForCreativeBlock: awardCreativityForCreativeBlock.mutateAsync,
    awardAlignmentForEpicProgress: awardAlignmentForEpicProgress.mutateAsync,
    awardAlignmentForRelationshipMaintenance: awardAlignmentForRelationshipMaintenance.mutateAsync,
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
  AttributeType,
  AwardCompanionAttributeResult,
  CompanionAttributeSourceEvent,
};
