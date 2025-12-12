import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { getCompanionEvolution } from "@/lib/firebase/companionEvolutions";
import { getMentor } from "@/lib/firebase/mentors";
import { onSnapshot } from "@/lib/firebase/firestore";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { useEvolution } from "@/contexts/EvolutionContext";

export const GlobalEvolutionListener = () => {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useProfile();
  const queryClient = useQueryClient();
  const { setIsEvolvingLoading, onEvolutionComplete } = useEvolution();
  const [isEvolving, setIsEvolving] = useState(false);
  const [evolutionData, setEvolutionData] = useState<{ 
    stage: number; 
    imageUrl: string;
    mentorSlug?: string;
  } | null>(null);
  const [previousStage, setPreviousStage] = useState<number | null>(null);

  useEffect(() => {
    // CRITICAL: Wait for auth to fully load before subscribing to Firestore
    // This prevents "Missing or insufficient permissions" errors on iOS
    if (authLoading) return;
    if (!user?.uid) return;

    // Track previous stage to detect changes
    let previousStage: number | null = null;
    let isSubscribed = true;

    // Subscribe to companion updates using Firestore real-time listener
    const unsubscribe = onSnapshot(
      { collection: "user_companion", docId: user.uid },
      async (snapshot) => {
        // Check if still subscribed (prevent updates after unmount)
        if (!isSubscribed) return;
        
        try {
          const newData = snapshot;
          
          if (!newData) {
            // Silently ignore missing data - companion may not exist yet
            return;
          }

          const newStage = typeof newData.current_stage === 'number' ? newData.current_stage : null;
          
          if (newStage === null) {
            return;
          }

          // Check if stage changed (evolution happened)
          if (previousStage !== null && newStage > previousStage) {
            // Validate companion id exists
            const companionId = typeof newData.id === 'string' ? newData.id : user.uid;
            
            // Fetch the latest evolution record to ensure we have the correct image
            const evolutionRecord = await getCompanionEvolution(companionId, newStage);
            
            const currentImageUrl = typeof newData.current_image_url === 'string' ? newData.current_image_url : "";
            const imageUrl = evolutionRecord?.image_url || currentImageUrl;

            // Fetch mentor slug if we have a selected mentor
            let mentorSlug: string | undefined;
            if (profile?.selected_mentor_id) {
              const mentor = await getMentor(profile.selected_mentor_id);
              mentorSlug = mentor?.slug;
            }

            if (isSubscribed) {
              setPreviousStage(previousStage);
              setEvolutionData({
                stage: newStage,
                imageUrl,
                mentorSlug,
              });
              setIsEvolving(true);
              
              // Notify walkthrough that evolution is starting
              window.dispatchEvent(new CustomEvent('evolution-loading-start'));

              // Invalidate companion query to refresh data
              queryClient.invalidateQueries({ queryKey: ['companion', user.uid] });
            }
          }
          
          // Update previous stage for next comparison
          previousStage = newStage;
        } catch (error) {
          // Silently handle errors - don't crash the app
          console.warn('Evolution listener data error:', error);
        }
      },
      (error: unknown) => {
        // Handle permission errors gracefully - common on iOS before auth is ready
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = (error as { code?: string })?.code;
        if (errorCode === 'permission-denied' || errorMessage?.includes('permission')) {
          console.warn('Evolution listener: Permission denied, will retry when auth is ready');
        } else {
          console.warn('Evolution listener subscription error:', error);
        }
      }
    );

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [authLoading, user?.uid, profile?.selected_mentor_id, queryClient]);

  if (!isEvolving || !evolutionData) {
    return null;
  }

  return (
    <CompanionEvolution
      isEvolving={isEvolving}
      newStage={evolutionData.stage}
      newImageUrl={evolutionData.imageUrl}
      mentorSlug={evolutionData.mentorSlug}
      userId={user?.uid}
      onComplete={() => {
        setIsEvolving(false);
        setEvolutionData(null);
        setPreviousStage(null);
        // Hide overlay after evolution animation completes
        setIsEvolvingLoading(false);
        
        // Call the walkthrough callback if one was set
        if (onEvolutionComplete) {
          onEvolutionComplete();
        }
      }}
    />
  );
};
