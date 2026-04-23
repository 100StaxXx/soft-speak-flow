import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { invalidateMentorContextQueries } from "@/lib/mentorContextQueryCache";
import { invalidateProfileQueries, refetchProfileQueries } from "@/lib/profileQueryCache";

type ProfileMentorChangeOptions = {
  mentorId: string;
  onboardingData: Record<string, unknown>;
  queryClient: QueryClient;
  supabaseClient: SupabaseClient;
  timezone: string;
  userId: string;
  navigate?: (to: string, options?: { replace?: boolean }) => void;
  destinationPath?: string | null;
};

export async function applyMentorChange({
  mentorId,
  onboardingData,
  queryClient,
  supabaseClient,
  timezone,
  userId,
  navigate,
  destinationPath,
}: ProfileMentorChangeOptions): Promise<void> {
  const { error } = await supabaseClient
    .from("profiles")
    .update({
      selected_mentor_id: mentorId,
      onboarding_data: {
        ...onboardingData,
        mentorId,
      },
      timezone,
    })
    .eq("id", userId);

  if (error) throw error;

  await invalidateProfileQueries(queryClient, {
    userId,
    includeDetail: true,
  });
  await refetchProfileQueries(queryClient, {
    userId,
    includeDetail: true,
  });
  await invalidateMentorContextQueries(queryClient, {
    includeMorningCheckIn: true,
  });

  if (navigate && destinationPath) {
    navigate(destinationPath, { replace: true });
  }
}
