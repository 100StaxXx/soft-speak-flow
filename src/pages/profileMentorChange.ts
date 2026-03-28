import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  await queryClient.invalidateQueries({ queryKey: ["profile", userId] });
  await queryClient.refetchQueries({ queryKey: ["profile", userId] });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["mentor-page-data"] }),
    queryClient.invalidateQueries({ queryKey: ["mentor-personality"] }),
    queryClient.invalidateQueries({ queryKey: ["mentor"] }),
    queryClient.invalidateQueries({ queryKey: ["selected-mentor"] }),
    queryClient.invalidateQueries({ queryKey: ["morning-check-in"] }),
  ]);

  if (navigate && destinationPath) {
    navigate(destinationPath, { replace: true });
  }
}
