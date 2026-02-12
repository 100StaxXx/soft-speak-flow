import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Syncs auth state changes with the query cache.
 * Invalidates profile and related data when user logs in/out to prevent stale data.
 */
export const useAuthSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        // On sign in or token refresh, refetch profile immediately to get fresh data
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Use setTimeout to avoid deadlock - defer Supabase calls
          setTimeout(async () => {
            try {
              // Await profile so mentor queries have resolvedMentorId ready
              await queryClient.refetchQueries({ queryKey: ["profile"] });

              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["mentor-page-data"] }),
                queryClient.invalidateQueries({ queryKey: ["mentor-personality"] }),
                queryClient.invalidateQueries({ queryKey: ["mentor"] }),
                queryClient.invalidateQueries({ queryKey: ["selected-mentor"] }),
              ]);
            } catch (error) {
              console.error("Auth sync refresh failed:", error);
            }
          }, 0);
        }
        
        // On sign out, clear all cached data
        if (event === 'SIGNED_OUT') {
          queryClient.clear();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [queryClient]);
};
