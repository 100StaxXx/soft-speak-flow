import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { useEvolution } from "@/contexts/EvolutionContext";
import { useCelebration } from "@/contexts/CelebrationContext";
import { logger } from "@/utils/logger";
import { getResolvedMentorId } from "@/utils/mentor";

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading, onEvolutionComplete } = useEvolution();
  const { setEvolutionInProgress } = useCelebration();
  const [isEvolving, setIsEvolving] = useState(false);
  const resolvedMentorId = getResolvedMentorId(profile);
  const [evolutionData, setEvolutionData] = useState<{ 
    stage: number; 
    imageUrl: string;
    mentorSlug?: string;
    element?: string;
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

            // Fetch the latest evolution record and companion data for element
            const [evolutionResult, companionResult] = await Promise.all([
              supabase
                .from('companion_evolutions')
                .select('image_url')
                .eq('companion_id', companionId)
                .eq('stage', newStage)
                .order('evolved_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from('user_companion')
                .select('core_element')
                .eq('id', companionId)
                .maybeSingle()
            ]);

            const currentImageUrl = typeof newData.current_image_url === 'string' ? newData.current_image_url : "";
            const imageUrl = evolutionResult.data?.image_url || currentImageUrl;
            const element = companionResult.data?.core_element || undefined;

            // Fetch mentor slug if we have a selected mentor
            let mentorSlug: string | undefined;
            if (resolvedMentorId) {
              const { data: mentor } = await supabase
                .from('mentors')
                .select('slug')
                .eq('id', resolvedMentorId)
                .maybeSingle();
              
              mentorSlug = mentor?.slug;
            }

            setPreviousStage(oldStage);
            setEvolutionData({
              stage: newStage,
              imageUrl,
              mentorSlug,
              element,
            });
            setIsEvolving(true);
            setEvolutionInProgress(true); // Mark evolution in progress for celebration queue
            
            // Notify walkthrough that evolution is starting
            window.dispatchEvent(new CustomEvent('evolution-loading-start'));

            // Create evolution memory (non-blocking)
            const today = new Date().toISOString().split('T')[0];
            const isFirstEvolution = newStage === 1;
            supabase.from('companion_memories').insert({
              user_id: user.id,
              companion_id: companionId,
              memory_type: isFirstEvolution ? 'first_evolution' : 'evolution',
              memory_date: today,
              memory_context: {
                title: isFirstEvolution ? 'First Evolution' : `Evolved to Stage ${newStage}`,
                description: isFirstEvolution 
                  ? 'The first transformation - proof of our growing bond.'
                  : `Another beautiful transformation, reaching stage ${newStage}.`,
                emotion: isFirstEvolution ? 'pride' : 'joy',
                details: { stage: newStage, previousStage: oldStage },
              },
              referenced_count: 0,
            }).then(({ error }) => {
              if (error) logger.error('Failed to create evolution memory:', error);
            });

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
  }, [user, user?.id, resolvedMentorId, queryClient, setEvolutionInProgress]); // Include all used dependencies

  if (!isEvolving || !evolutionData) {
    return null;
  }

  return (
    <CompanionEvolution
      isEvolving={isEvolving}
      newStage={evolutionData.stage}
      newImageUrl={evolutionData.imageUrl}
      mentorSlug={evolutionData.mentorSlug}
      element={evolutionData.element}
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
