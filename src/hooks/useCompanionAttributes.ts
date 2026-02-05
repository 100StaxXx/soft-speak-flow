import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { ECHO_MAP, AttributeType } from "@/config/attributeDescriptions";

// Stat scale constants
const STAT_MIN = 100;
const STAT_MAX = 1000;
const STAT_DEFAULT = 300;

interface UpdateAttributeParams {
  companionId: string;
  attribute: AttributeType;
  amount: number;
  applyEchoGains?: boolean;
}

export const useCompanionAttributes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateAttribute = useMutation({
    mutationFn: async ({ companionId, attribute, amount, applyEchoGains = true }: UpdateAttributeParams) => {
      if (!user) throw new Error("Not authenticated");

      // Get current companion data (6 stats)
      const { data: companion, error: fetchError } = await supabase
        .from("user_companion")
        .select("vitality, wisdom, discipline, resolve, creativity, alignment")
        .eq("id", companionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!companion) throw new Error("Companion not found");

      // Calculate new primary stat value (100-1000 scale)
      const currentValue = companion[attribute] ?? STAT_DEFAULT;
      const newValue = Math.max(STAT_MIN, Math.min(STAT_MAX, currentValue + amount));

      // Build update object with primary stat
      const updates: Record<string, number | string> = {
        [attribute]: newValue,
        last_energy_update: new Date().toISOString()
      };

      // Apply echo gains if enabled and amount is positive
      if (applyEchoGains && amount > 0) {
        const echoStats = ECHO_MAP[attribute] || [];
        // 20% of gain, max +20 (scaled for 1000 range)
        const echoAmount = Math.min(20, Math.floor(amount * 0.2));
        
        if (echoAmount > 0) {
          for (const echoStat of echoStats) {
            const echoCurrentValue = companion[echoStat] ?? STAT_DEFAULT;
            updates[echoStat] = Math.min(STAT_MAX, Math.max(STAT_MIN, echoCurrentValue + echoAmount));
          }
        }
      }

      // Update all stats
      const { error: updateError } = await supabase
        .from("user_companion")
        .update(updates)
        .eq("id", companionId)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      return { attribute, newValue, change: amount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      // Show toast for significant changes (scaled for 1000 range)
      if (Math.abs(data.change) >= 50) {
        const emoji = data.change > 0 ? "⬆️" : "⬇️";
        const direction = data.change > 0 ? "increased" : "decreased";
        const attrInfo = ATTRIBUTE_DESCRIPTIONS_SIMPLE[data.attribute];
        toast.success(`${emoji} ${attrInfo?.name || data.attribute} ${direction}!`, {
          duration: 2000,
        });
      }
    },
    onError: (error) => {
      console.error('Attribute update failed:', error);
    },
  });

  // Specific update methods for different activities (scaled for 1000 range)
  const updateVitalityFromFitness = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'vitality', amount: 50 });
    },
  });

  const updateWisdomFromLearning = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'wisdom', amount: 40 });
    },
  });

  const updateDisciplineFromRitual = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'discipline', amount: 30 });
    },
  });

  const updateDisciplineFromWork = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'discipline', amount: 50 });
    },
  });

  const updateResolveFromResist = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'resolve', amount: 80 });
    },
  });

  const updateCreativityFromShipping = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'creativity', amount: 50 });
    },
  });

  const updateAlignmentFromReflection = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'alignment', amount: 30 });
    },
  });

  // Streak milestone rewards (scaled for 1000 range)
  const updateFromStreakMilestone = useMutation({
    mutationFn: async ({ companionId, streakDays }: { companionId: string; streakDays: number }) => {
      if (!user) throw new Error("Not authenticated");

      let disciplineGain = 0;
      if (streakDays === 7) disciplineGain = 50;
      else if (streakDays === 14) disciplineGain = 80;
      else if (streakDays === 30) disciplineGain = 120;
      else if (streakDays % 7 === 0) disciplineGain = 20;

      if (disciplineGain > 0) {
        await updateAttribute.mutateAsync({ 
          companionId, 
          attribute: 'discipline', 
          amount: disciplineGain 
        });
      }
    },
  });

  // Perfect day bonus - small boost to alignment
  const updateFromPerfectDay = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ 
        companionId, 
        attribute: 'alignment', 
        amount: 30,
        applyEchoGains: true 
      });
    },
  });

  // Decay for inactivity - now handled by weekly maintenance in edge function
  // This is kept for manual decay if needed, with 100 floor
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

      // Weekly maintenance amounts (scaled for 1000 range)
      const decayAmounts: Record<string, number> = {
        discipline: 40,
        vitality: 30,
        creativity: 25,
        resolve: 20,
        wisdom: 15,
        alignment: 15,
      };

      const updates: Record<string, number | string> = {
        last_energy_update: new Date().toISOString()
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
    updateAttribute: updateAttribute.mutateAsync,
    updateVitalityFromFitness: updateVitalityFromFitness.mutateAsync,
    updateWisdomFromLearning: updateWisdomFromLearning.mutateAsync,
    updateDisciplineFromRitual: updateDisciplineFromRitual.mutateAsync,
    updateDisciplineFromWork: updateDisciplineFromWork.mutateAsync,
    updateResolveFromResist: updateResolveFromResist.mutateAsync,
    updateCreativityFromShipping: updateCreativityFromShipping.mutateAsync,
    updateAlignmentFromReflection: updateAlignmentFromReflection.mutateAsync,
    updateFromStreakMilestone: updateFromStreakMilestone.mutateAsync,
    updateFromPerfectDay: updateFromPerfectDay.mutateAsync,
    decayStats: decayStats.mutateAsync,
  };
};

// Simple name lookup for toast messages
const ATTRIBUTE_DESCRIPTIONS_SIMPLE: Record<AttributeType, { name: string }> = {
  vitality: { name: "Vitality" },
  wisdom: { name: "Wisdom" },
  discipline: { name: "Discipline" },
  resolve: { name: "Resolve" },
  creativity: { name: "Creativity" },
  alignment: { name: "Alignment" },
};

export type { AttributeType };
