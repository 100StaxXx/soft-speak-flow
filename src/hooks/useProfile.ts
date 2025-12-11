import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { getProfile, createProfile, type Profile } from "@/lib/firebase/profiles";

export const useProfile = () => {
  const { user } = useAuth();

  const { data: profile, isLoading: loading, error: profileError } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: async () => {
      if (!user) return null;

      try {
        // Get profile from Firestore
        let profileData = await getProfile(user.uid);

        if (!profileData) {
          // Auto-create profile on first login if missing
          console.log(`[useProfile] Profile not found for user ${user.uid}, creating new profile`);
          profileData = await createProfile(user.uid, user.email ?? null);
          console.log(`[useProfile] Profile created for user ${user.uid}`);
        }

        return profileData;
      } catch (error) {
        console.error("[useProfile] Error fetching profile:", error);
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 60 seconds - cache profile data longer for better performance
    refetchOnWindowFocus: false, // Prevent unnecessary refetches on tab switch
    retry: 2, // Retry failed requests
    retryDelay: 1000, // Wait 1 second between retries
  });

  // Log profile errors for debugging
  if (profileError) {
    console.error("[useProfile] Profile query error:", profileError);
  }

  return { profile: profile ?? null, loading };
};

export type { Profile };
