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
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Check if stage changed (evolution happened)
          if (newData.current_stage > oldData.current_stage) {
            console.log('Evolution detected!', {
              oldStage: oldData.current_stage,
              newStage: newData.current_stage,
              imageUrl: newData.current_image_url,
            });

            setPreviousStage(oldData.current_stage);
            setEvolutionData({
              stage: newData.current_stage,
              imageUrl: newData.current_image_url || "",
            });
            setIsEvolving(true);

            // Invalidate companion query to refresh data
            queryClient.invalidateQueries({ queryKey: ['companion'] });
          }
        }
      )
      .subscribe();

    return () => {
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
