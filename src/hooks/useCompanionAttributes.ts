import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { ECHO_MAP, AttributeType } from "@/config/attributeDescriptions";

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

      // Get current companion data
      const { data: companion, error: fetchError } = await supabase
        .from("user_companion")
        .select("vitality, power, wisdom, discipline, resolve, connection, alignment")
        .eq("id", companionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!companion) throw new Error("Companion not found");

      // Calculate new primary stat value
      const currentValue = companion[attribute] ?? 30;
      const newValue = Math.max(0, Math.min(100, currentValue + amount));

      // Build update object with primary stat
      const updates: Record<string, number | string> = {
        [attribute]: newValue,
        last_energy_update: new Date().toISOString()
      };

      // Apply echo gains if enabled and amount is positive
      if (applyEchoGains && amount > 0) {
        const echoStats = ECHO_MAP[attribute] || [];
        const echoAmount = Math.min(2, Math.floor(amount * 0.2)); // 20% of gain, max +2
        
        if (echoAmount > 0) {
          for (const echoStat of echoStats) {
            const echoCurrentValue = companion[echoStat] ?? 30;
            updates[echoStat] = Math.min(100, echoCurrentValue + echoAmount);
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
      
      if (Math.abs(data.change) >= 10) {
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

  // Specific update methods for different activities
  const updateVitalityFromFitness = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'vitality', amount: 5 });
    },
  });

  const updatePowerFromWork = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'power', amount: 5 });
    },
  });

  const updateWisdomFromLearning = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'wisdom', amount: 5 });
    },
  });

  const updateDisciplineFromRitual = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'discipline', amount: 3 });
    },
  });

  const updateResolveFromResist = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'resolve', amount: 8 });
    },
  });

  const updateConnectionFromSocial = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'connection', amount: 5 });
    },
  });

  const updateAlignmentFromReflection = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");
      await updateAttribute.mutateAsync({ companionId, attribute: 'alignment', amount: 5 });
    },
  });

  // Streak milestone rewards
  const updateFromStreakMilestone = useMutation({
    mutationFn: async ({ companionId, streakDays }: { companionId: string; streakDays: number }) => {
      if (!user) throw new Error("Not authenticated");

      let disciplineGain = 0;
      if (streakDays === 7) disciplineGain = 5;
      else if (streakDays === 14) disciplineGain = 8;
      else if (streakDays === 30) disciplineGain = 12;
      else if (streakDays % 7 === 0) disciplineGain = 2;

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
        amount: 3,
        applyEchoGains: true 
      });
    },
  });

  // Decay for inactivity (applies to all stats)
  const decayStats = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { data: companion, error: fetchError } = await supabase
        .from("user_companion")
        .select("vitality, power, wisdom, discipline, resolve, connection, alignment")
        .eq("id", companionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!companion) throw new Error("Companion not found");

      const decayAmount = 3;
      const minFloor = 10;

      const updates: Record<string, number | string> = {
        vitality: Math.max(minFloor, (companion.vitality ?? 50) - decayAmount),
        power: Math.max(minFloor, (companion.power ?? 30) - decayAmount),
        wisdom: Math.max(minFloor, (companion.wisdom ?? 30) - decayAmount),
        discipline: Math.max(minFloor, (companion.discipline ?? 30) - decayAmount),
        resolve: Math.max(minFloor, (companion.resolve ?? 30) - decayAmount),
        connection: Math.max(minFloor, (companion.connection ?? 30) - decayAmount),
        alignment: Math.max(minFloor, (companion.alignment ?? 30) - decayAmount),
        last_energy_update: new Date().toISOString()
      };

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
    updatePowerFromWork: updatePowerFromWork.mutateAsync,
    updateWisdomFromLearning: updateWisdomFromLearning.mutateAsync,
    updateDisciplineFromRitual: updateDisciplineFromRitual.mutateAsync,
    updateResolveFromResist: updateResolveFromResist.mutateAsync,
    updateConnectionFromSocial: updateConnectionFromSocial.mutateAsync,
    updateAlignmentFromReflection: updateAlignmentFromReflection.mutateAsync,
    updateFromStreakMilestone: updateFromStreakMilestone.mutateAsync,
    updateFromPerfectDay: updateFromPerfectDay.mutateAsync,
    decayStats: decayStats.mutateAsync,
  };
};

// Simple name lookup for toast messages
const ATTRIBUTE_DESCRIPTIONS_SIMPLE: Record<AttributeType, { name: string }> = {
  vitality: { name: "Vitality" },
  power: { name: "Power" },
  wisdom: { name: "Wisdom" },
  discipline: { name: "Discipline" },
  resolve: { name: "Resolve" },
  connection: { name: "Connection" },
  alignment: { name: "Alignment" },
};

export type { AttributeType };
