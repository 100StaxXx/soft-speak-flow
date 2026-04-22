import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MentorSelection from "./MentorSelection";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  toast: vi.fn(),
  navigate: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    refetchQueries: vi.fn().mockResolvedValue(undefined),
  },
  mentorRows: [
    {
      id: "mentor-legacy-atlas",
      name: "Atlas",
      slug: "atlas",
      mentor_type: "Legacy Guide",
      description: "Old roster entry",
      short_title: "Legacy",
      tone_description: "Old tone",
      style_description: "Old style",
      target_user: "Legacy users",
      signature_line: "Outdated.",
      primary_color: "#111827",
      avatar_url: null,
      themes: ["legacy"],
      is_active: true,
    },
    {
      id: "mentor-1",
      name: "The Sage",
      slug: "sage",
      mentor_type: "coach",
      description: "Cosmic guide",
      short_title: "Quiet Clarity",
      tone_description: "Calm and clear",
      style_description: "Calm and clear",
      target_user: "Focused builders",
      signature_line: "Build the system, then trust it.",
      primary_color: "#7B68EE",
      avatar_url: null,
      themes: ["discipline", "clarity"],
      is_active: true,
    },
    {
      id: "mentor-2",
      name: "Lyra",
      slug: "lyra",
      mentor_type: "Synthetic Oracle",
      description: "Signal-first strategist",
      short_title: "Synthetic Oracle",
      tone_description: "Futuristic and poised",
      style_description: "Elegant and precise",
      target_user: "Builders seeking signal",
      signature_line: "The pattern is already there. I will help you see it.",
      primary_color: "#A855F7",
      avatar_url: null,
      themes: ["signal", "clarity", "future-facing"],
      is_active: true,
    },
    {
      id: "mentor-legacy-stryker",
      name: "Stryker",
      slug: "stryker",
      mentor_type: "Legacy Guide",
      description: "Old roster entry",
      short_title: "Legacy",
      tone_description: "Old tone",
      style_description: "Old style",
      target_user: "Legacy users",
      signature_line: "Outdated.",
      primary_color: "#0f172a",
      avatar_url: null,
      themes: ["legacy"],
      is_active: true,
    },
  ],
  selectedMentorId: "mentor-1",
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName }: { mentorName: string }) => <div>{mentorName} Avatar</div>,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "mentors") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: mocks.mentorRows, error: null }),
            }),
          }),
        };
      }

      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { selected_mentor_id: mocks.selectedMentorId },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

describe("MentorSelection", () => {
  beforeEach(() => {
    mocks.toast.mockClear();
    mocks.navigate.mockClear();
    mocks.queryClient.invalidateQueries.mockClear();
    mocks.queryClient.refetchQueries.mockClear();
  });

  it("shows Lyra and The Guy in the browse catalog alongside active mentors", async () => {
    render(<MentorSelection />);

    expect(await screen.findByText("The Sage")).toBeInTheDocument();
    expect(screen.getByText("Lyra")).toBeInTheDocument();
    expect(screen.getByText("The Guy")).toBeInTheDocument();
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
    expect(screen.queryByText("Stryker")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Upcoming Unlockable/i)).toHaveLength(1);
    });
  });
});
