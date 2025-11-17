import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{ 
    stage: number; 
    imageUrl: string;
  } | null>(null);
  const [previousStage, setPreviousStage] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      console.log('GlobalEvolutionListener: No user, skipping subscription');
      return;
    }

    console.log('GlobalEvolutionListener: Setting up subscription for user:', user.id);

    // Subscribe to companion updates
    const channel = supabase
      .channel('companion-evolution')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_companion',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          console.log('GlobalEvolutionListener: Companion update received:', { 
            newData, 
            oldData,
            hasOldData: !!oldData,
            stageChanged: oldData && newData.current_stage > oldData.current_stage
          });

          // Check if stage changed (evolution happened)
          if (oldData && newData.current_stage > oldData.current_stage) {
            console.log('GlobalEvolutionListener: Evolution detected!', {
              oldStage: oldData.current_stage,
              newStage: newData.current_stage,
              imageUrl: newData.current_image_url,
            });

            // Fetch the latest evolution record to ensure we have the correct image
            const { data: evolutionRecord } = await supabase
              .from('companion_evolutions')
              .select('image_url')
              .eq('companion_id', newData.id)
              .eq('stage', newData.current_stage)
              .order('evolved_at', { ascending: false })
              .limit(1)
              .single();

            console.log('GlobalEvolutionListener: Evolution record:', evolutionRecord);

            const imageUrl = evolutionRecord?.image_url || newData.current_image_url || "";

            console.log('GlobalEvolutionListener: Setting evolution state with imageUrl:', imageUrl);

            setPreviousStage(oldData.current_stage);
            setEvolutionData({
              stage: newData.current_stage,
              imageUrl,
            });
            setIsEvolving(true);

            // Invalidate companion query to refresh data
            queryClient.invalidateQueries({ queryKey: ['companion'] });
          }
        }
      )
      .subscribe((status) => {
        console.log('GlobalEvolutionListener: Subscription status:', status);
      });

    return () => {
      console.log('GlobalEvolutionListener: Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  if (!isEvolving || !evolutionData) {
    return null;
  }

  return (
    <CompanionEvolution
      isEvolving={isEvolving}
      newStage={evolutionData.stage}
      newImageUrl={evolutionData.imageUrl}
      mentorSlug={profile?.selected_mentor_id}
      userId={user?.id}
      onComplete={() => {
        setIsEvolving(false);
        setEvolutionData(null);
        setPreviousStage(null);
      }}
    />
  );
};
