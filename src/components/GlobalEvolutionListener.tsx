import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { getCompanionEvolution } from "@/lib/firebase/companionEvolutions";
import { getMentor } from "@/lib/firebase/mentors";
import { getDocument, onSnapshot } from "@/lib/firebase/firestore";
import { CompanionEvolution } from "@/components/CompanionEvolution";
import { useEvolution } from "@/contexts/EvolutionContext";

export const GlobalEvolutionListener = () => {
  const { user } = useAuth();
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
    if (!user?.uid) return;

    // Track previous stage to detect changes
    let previousStage: number | null = null;

    // Subscribe to companion updates using Firestore real-time listener
    const unsubscribe = onSnapshot(
      { collection: "user_companion", docId: user.uid },
      async (snapshot) => {
        const newData = snapshot;
        
        if (!newData) {
          console.warn('Evolution listener: Missing companion data');
          return;
        }

        const newStage = typeof newData.current_stage === 'number' ? newData.current_stage : null;
        
        if (newStage === null) {
          console.warn('Evolution listener: Invalid stage value');
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
        
        // Update previous stage for next comparison
        previousStage = newStage;
      },
      (error) => {
        console.warn('Evolution listener subscription error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user, user?.uid, profile?.selected_mentor_id, queryClient]);

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
