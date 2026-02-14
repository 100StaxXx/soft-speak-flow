import { describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { applyMentorChange } from "./profileMentorChange";

describe("applyMentorChange", () => {
  it("updates mentor selection, refreshes cache, and navigates without a full reload path", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    const refetchQueries = vi.fn().mockResolvedValue(undefined);
    const queryClient = {
      invalidateQueries,
      refetchQueries,
    } as unknown as QueryClient;

    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const supabaseClient = {
      from,
    } as unknown as SupabaseClient;

    const navigate = vi.fn();
    await applyMentorChange({
      mentorId: "mentor-2",
      onboardingData: { storyTone: "bold" },
      queryClient,
      supabaseClient,
      timezone: "America/Los_Angeles",
      userId: "user-123",
      navigate,
    });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({
      selected_mentor_id: "mentor-2",
      onboarding_data: {
        storyTone: "bold",
        mentorId: "mentor-2",
      },
      timezone: "America/Los_Angeles",
    });
    expect(eq).toHaveBeenCalledWith("id", "user-123");

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["profile", "user-123"] });
    expect(refetchQueries).toHaveBeenCalledWith({ queryKey: ["profile", "user-123"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mentor-page-data"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mentor-personality"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mentor"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["selected-mentor"] });
    expect(navigate).toHaveBeenCalledWith("/mentor", { replace: true });
  });
});
