import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type AttributeType = 'mind' | 'body' | 'soul';

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
        .maybeSingle();

      if (fetchError || !companion) throw fetchError || new Error('Companion not found');

      const currentValue = companion[attribute] ?? (attribute === 'body' ? 100 : 0);
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
      
      // Show toast for significant changes only (reduced threshold to avoid spam)
      if (Math.abs(data.change) >= 10) {
        const emoji = data.change > 0 ? "⬆️" : "⬇️";
        const direction = data.change > 0 ? "increased" : "decreased";
        const attribute = data.attribute.charAt(0).toUpperCase() + data.attribute.slice(1);
        toast.success(`${emoji} ${attribute} ${direction}!`, {
          duration: 2000, // Shorter duration to reduce notification spam
        });
      }
    },
    onError: (error) => {
      console.error('Attribute update failed:', error);
      // Silent failure - don't spam user with errors for background updates
    },
  });

  const updateBodyFromActivity = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Award +10 body for daily activity, capped at 100
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'body',
        amount: 10,
      });
    },
  });

  const updateSoulFromStreak = useMutation({
    mutationFn: async ({ companionId, streakDays }: { companionId: string; streakDays: number }) => {
      if (!user) throw new Error("Not authenticated");

      // Award soul based on streak milestones
      let soulGain = 0;
      if (streakDays === 7) soulGain = 5;
      else if (streakDays === 14) soulGain = 10;
      else if (streakDays === 30) soulGain = 15;
      else if (streakDays % 7 === 0) soulGain = 2; // Small bonus every week

      if (soulGain > 0) {
        await updateAttribute.mutateAsync({
          companionId,
          attribute: 'soul',
          amount: soulGain,
        });
      }
    },
  });

  const updateMindFromHabit = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Award +2 mind per habit completion
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'mind',
        amount: 2,
      });
    },
  });

  const updateSoulFromReflection = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Award +3 soul for check-ins and reflections
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'soul',
        amount: 3,
      });
    },
  });

  const decayBody = useMutation({
    mutationFn: async (companionId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Decrease body by -5 for inactivity
      await updateAttribute.mutateAsync({
        companionId,
        attribute: 'body',
        amount: -5,
      });
    },
  });

  return {
    updateAttribute: updateAttribute.mutateAsync,
    updateBodyFromActivity: updateBodyFromActivity.mutateAsync,
    updateSoulFromStreak: updateSoulFromStreak.mutateAsync,
    updateMindFromHabit: updateMindFromHabit.mutateAsync,
    updateSoulFromReflection: updateSoulFromReflection.mutateAsync,
    decayBody: decayBody.mutateAsync,
  };
};
