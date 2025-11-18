import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type AttributeType = 'resilience' | 'focus' | 'balance' | 'energy';

interface UpdateAttributeParams {
  companionId: string;
  attribute: AttributeType;
  amount: number; // Can be positive or negative
}

export const useCompanionAttributes = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const updateAttribute = useMutation({
    mutationFn: async ({ companionId, attribute, amount }: UpdateAttributeParams) => {
      if (!user) throw new Error("Not authenticated");

      // Get current companion data
      const { data: companion, error: fetchError } = await supabase
        .from("user_companion")
        .select(attribute)
        .eq("id", companionId)
        .single();

      if (fetchError) throw fetchError;

      const currentValue = companion[attribute] ?? (attribute === 'energy' ? 100 : 0);
      const newValue = Math.max(0, Math.min(100, currentValue + amount));

      // Update the attribute
      const { error: updateError } = await supabase
        .from("user_companion")
        .update({ 
          [attribute]: newValue,
          last_energy_update: new Date().toISOString()
        })
        .eq("id", companionId);

      if (updateError) throw updateError;

      return { attribute, newValue, change: amount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["companion"] });
      
      // Show toast for significant changes
      if (Math.abs(data.change) >= 5) {
        const emoji = data.change > 0 ? "⬆️" : "⬇️";
        const direction = data.change > 0 ? "increased" : "decreased";
        toast.success(`${emoji} ${data.attribute.charAt(0).toUpperCase() + data.attribute.slice(1)} ${direction}!`);
      }
    },
  });

  const updateEnergyFromActivity = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Award +10 energy for daily activity, capped at 100
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'energy',
        amount: 10,
      });
    },
  });

  const updateResilienceFromStreak = useMutation({
    mutationFn: async ({ companionId, streakDays }: { companionId: string; streakDays: number }) => {
      if (!user) throw new Error("Not authenticated");

      // Award resilience based on streak milestones
      let resilienceGain = 0;
      if (streakDays === 7) resilienceGain = 5;
      else if (streakDays === 14) resilienceGain = 10;
      else if (streakDays === 30) resilienceGain = 15;
      else if (streakDays % 7 === 0) resilienceGain = 2; // Small bonus every week

      if (resilienceGain > 0) {
        await updateAttribute.mutateAsync({
          companionId,
          attribute: 'resilience',
          amount: resilienceGain,
        });
      }
    },
  });

  const updateFocusFromHabit = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Award +2 focus per habit completion
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'focus',
        amount: 2,
      });
    },
  });

  const updateBalanceFromReflection = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Award +3 balance for check-ins and reflections
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'balance',
        amount: 3,
      });
    },
  });

  const decayEnergy = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Decrease energy by -5 for inactivity
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'energy',
        amount: -5,
      });
    },
  });

  return {
    updateAttribute: updateAttribute.mutateAsync,
    updateEnergyFromActivity: updateEnergyFromActivity.mutateAsync,
    updateResilienceFromStreak: updateResilienceFromStreak.mutateAsync,
    updateFocusFromHabit: updateFocusFromHabit.mutateAsync,
    updateBalanceFromReflection: updateBalanceFromReflection.mutateAsync,
    decayEnergy: decayEnergy.mutateAsync,
  };
};