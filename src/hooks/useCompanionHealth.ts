import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCompanion } from "./useCompanion";
import { useMemo } from "react";
import { normalizeCompanionAssetSourceUrls } from "@/lib/companionAssetResolver";

interface CompanionHealth {
  daysInactive: number;
  imageUrl: string | null;
  imageFocalX: number | null;
  imageFocalY: number | null;
}

/**
 * Supplies the companion portrait and enough return context for a warm greeting.
 * Time away never damages the companion or changes its artwork.
 */
export const useCompanionHealth = () => {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const queryClient = useQueryClient();

  const { data: companionHealthData, isLoading: isHealthLoading } = useQuery({
    queryKey: ['companion-health', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companion')
        .select('inactive_days, current_image_url, current_image_focal_x, current_image_focal_y')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch companion return context:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });

  const health: CompanionHealth = useMemo(() => {
    const normalizedCompanionHealthData = companionHealthData
      ? normalizeCompanionAssetSourceUrls(companionHealthData)
      : null;

    const inactiveDays = normalizedCompanionHealthData?.inactive_days ?? 0;
    const imageUrl = normalizedCompanionHealthData?.current_image_url || companion?.current_image_url || null;
    const imageFocalX = normalizedCompanionHealthData?.current_image_focal_x ?? companion?.current_image_focal_x ?? null;
    const imageFocalY = normalizedCompanionHealthData?.current_image_focal_y ?? companion?.current_image_focal_y ?? null;

    return {
      daysInactive: inactiveDays,
      imageUrl,
      imageFocalX,
      imageFocalY,
    };
  }, [companionHealthData, companion]);

  // Function to mark user as active (call when user completes any activity)
  const markUserActive = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.rpc('mark_companion_active');
      if (error) throw error;

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['companion-health'] });
      queryClient.invalidateQueries({ queryKey: ['companion'] });
    } catch (error) {
      console.error('Failed to mark user active:', error);
    }
  };

  const needsWelcomeBack = health.daysInactive >= 2;

  return {
    health,
    isLoading: isHealthLoading,
    markUserActive,
    needsWelcomeBack,
  };
};
