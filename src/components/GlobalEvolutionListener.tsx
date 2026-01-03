import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCelebration } from "@/contexts/CelebrationContext";
import { logger } from "@/utils/logger";

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading, onEvolutionComplete } = useEvolution();
  const { setEvolutionInProgress } = useCelebration();
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
          // Type guard for payload structure
          const newData = payload.new as Record<string, unknown> | null;
          const oldData = payload.old as Record<string, unknown> | null;

          // Validate required fields exist and are numbers
          if (!newData || !oldData) {
            logger.warn('Evolution listener: Missing payload data');
            return;
          }

          const newStage = typeof newData.current_stage === 'number' ? newData.current_stage : null;
          const oldStage = typeof oldData.current_stage === 'number' ? oldData.current_stage : null;

          if (newStage === null || oldStage === null) {
            logger.warn('Evolution listener: Invalid stage values');
            return;
          }

          // Check if stage changed (evolution happened)
          if (newStage > oldStage) {
            // Validate companion id exists
            const companionId = typeof newData.id === 'string' ? newData.id : null;
            if (!companionId) {
              logger.warn('Evolution listener: Missing companion id');
              return;
            }

            // Fetch the latest evolution record to ensure we have the correct image
            const { data: evolutionRecord } = await supabase
              .from('companion_evolutions')
              .select('image_url')
              .eq('companion_id', companionId)
              .eq('stage', newStage)
              .order('evolved_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const currentImageUrl = typeof newData.current_image_url === 'string' ? newData.current_image_url : "";
            const imageUrl = evolutionRecord?.image_url || currentImageUrl;

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

            setPreviousStage(oldStage);
            setEvolutionData({
              stage: newStage,
              imageUrl,
              mentorSlug,
            });
            setIsEvolving(true);
            setEvolutionInProgress(true); // Mark evolution in progress for celebration queue
            
            // Notify walkthrough that evolution is starting
            window.dispatchEvent(new CustomEvent('evolution-loading-start'));

            // Invalidate companion query to refresh data
            if (user?.id) {
              queryClient.invalidateQueries({ queryKey: ['companion', user.id] });
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          // Successfully subscribed
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Evolution listener subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, user?.id, profile?.selected_mentor_id, queryClient]); // Include all used dependencies

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
        setEvolutionInProgress(false); // Mark evolution complete for celebration queue
        
        // Call the walkthrough callback if one was set
        if (onEvolutionComplete) {
          onEvolutionComplete();
        }
      }}
    />
  );
};
