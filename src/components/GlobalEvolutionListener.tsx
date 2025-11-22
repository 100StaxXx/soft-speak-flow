import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { useEvolution } from "@/contexts/EvolutionContext";

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading } = useEvolution();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{ 
    stage: number; 
    imageUrl: string;
    mentorSlug?: string;
  } | null>(null);
  const [previousStage, setPreviousStage] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

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

          // Check if stage changed (evolution happened)
          if (oldData && newData.current_stage > oldData.current_stage) {
            // Fetch the latest evolution record to ensure we have the correct image
            const { data: evolutionRecord } = await supabase
              .from('companion_evolutions')
              .select('image_url')
              .eq('companion_id', newData.id)
              .eq('stage', newData.current_stage)
              .order('evolved_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const imageUrl = evolutionRecord?.image_url || newData.current_image_url || "";

            // Fetch mentor slug if we have a selected mentor
            let mentorSlug: string | undefined;
            if (profile?.selected_mentor_id) {
              const { data: mentor } = await supabase
                .from('mentors')
                .select('slug')
                .eq('id', profile.selected_mentor_id)
                .maybeSingle();
              
              mentorSlug = mentor?.slug;
            }

            setPreviousStage(oldData.current_stage);
            setEvolutionData({
              stage: newData.current_stage,
              imageUrl,
              mentorSlug,
            });
            setIsEvolving(true);
            
            // Notify walkthrough that evolution is starting
            window.dispatchEvent(new CustomEvent('companion-evolution-start'));

            // Invalidate companion query to refresh data
            queryClient.invalidateQueries({ queryKey: ['companion'] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient, profile?.selected_mentor_id, setIsEvolvingLoading]);

  if (!isEvolving || !evolutionData) {
    return null;
  }

  return (
    <CompanionEvolution
      isEvolving={isEvolving}
      newStage={evolutionData.stage}
      newImageUrl={evolutionData.imageUrl}
      mentorSlug={evolutionData.mentorSlug}
      userId={user?.id}
      onComplete={() => {
        setIsEvolving(false);
        setEvolutionData(null);
        setPreviousStage(null);
        // Hide overlay after evolution animation completes
        setIsEvolvingLoading(false);
        
        // Notify walkthrough that evolution modal has closed
        window.dispatchEvent(new CustomEvent('evolution-modal-closed'));
      }}
    />
  );
};
