import { Button } from "@/components/ui/button";
import { Moon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useCompanion } from "@/hooks/useCompanion";
import { format } from "date-fns";

export const RestDayButton = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { companion, awardXP } = useCompanion();

  const takeRestDay = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const today = format(new Date(), 'yyyy-MM-dd');

      // Check if already took rest today
      const { data: existing, error: existingError } = await supabase
        .from('daily_missions')
        .select('id')
        .eq('user_id', user.id)
        .eq('mission_date', today)
        .eq('mission_type', 'rest_day')
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existing) {
        throw new Error('You already took a rest day today');
      }

      // Create rest day mission
      const { error } = await supabase
        .from('daily_missions')
        .insert({
          user_id: user.id,
          mission_date: today,
          mission_text: 'Rest and Recover',
          mission_type: 'rest_day',
          category: 'soul',
          xp_reward: 15,
          difficulty: 'easy',
          completed: true,
          completed_at: new Date().toISOString()
        });

      if (error) throw error;

      // Award soul XP using companion awardXP
      if (companion) {
        awardXP.mutate({
          eventType: 'rest_day',
          xpAmount: 15,
        });
      }

      // Update companion soul attribute
      const { data: companionData } = await supabase
        .from('user_companion')
        .select('soul')
        .eq('user_id', user.id)
        .maybeSingle();

      if (companionData) {
        const newSoul = Math.min(100, (companionData.soul || 0) + 5);
        await supabase
          .from('user_companion')
          .update({ soul: newSoul })
          .eq('user_id', user.id);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ['companion', user.id] });
      }
      toast.success('Rest day taken! 🌙', {
        description: 'Recovery fuels growth. +15 XP, +5 Soul'
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => takeRestDay.mutate()}
      disabled={takeRestDay.isPending}
      className="gap-2"
    >
      <Moon className="h-4 w-4" />
      Take a Rest Day
    </Button>
  );
};