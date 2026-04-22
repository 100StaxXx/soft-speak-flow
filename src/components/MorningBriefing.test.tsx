import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MorningBriefing } from "./MorningBriefing";

const mocks = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  toastMock: vi.fn(),
  useMorningBriefingMock: vi.fn(),
  useMentorPersonalityMock: vi.fn(),
  loadMentorImageMock: vi.fn(),
  dialogOnOpenChange: null as null | ((open: boolean) => void),
  generateMutateAsync: vi.fn().mockResolvedValue(undefined),
  dismissMutateAsync: vi.fn().mockResolvedValue(undefined),
  markViewedMutate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigateMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toastMock }),
}));

vi.mock("@/hooks/useMorningBriefing", () => ({
  useMorningBriefing: () => mocks.useMorningBriefingMock(),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => mocks.useMentorPersonalityMock(),
}));

vi.mock("@/utils/mentorImageLoader", () => ({
  loadMentorImage: (...args: unknown[]) => mocks.loadMentorImageMock(...args),
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName, size }: { mentorName: string; size?: string }) => (
    <div data-testid={`mentor-avatar-${size ?? "md"}`}>{mentorName} avatar</div>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) => {
    mocks.dialogOnOpenChange = onOpenChange ?? null;
    return open ? <div data-testid="dialog-root">{children}</div> : null;
  },
  DialogContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}));

const personality = {
  name: "Lyra",
  slug: "lyra",
  tone: "Supportive",
  style: "Direct",
  avatar_url: "https://example.com/lyra.png",
  primary_color: "#ff7a59",
  buttonText: (action: string) => action,
  emptyState: (context: string) => context,
  encouragement: () => "Keep going",
  nudge: () => "Stay on it",
};

const briefing = {
  id: "briefing-1",
  user_id: "user-1",
  briefing_date: "2026-04-21",
  mentor_id: "mentor-1",
  content: "A".repeat(320),
  inferred_goals: ["Ship the thing"],
  todays_focus: "Finish the core task",
  action_prompt: "What matters most next?",
  data_snapshot: {},
  created_at: "2026-04-21T08:00:00.000Z",
  viewed_at: null,
  dismissed_at: null,
};

describe("MorningBriefing", () => {
  beforeEach(() => {
    mocks.navigateMock.mockReset();
    mocks.toastMock.mockReset();
    mocks.generateMutateAsync.mockClear();
    mocks.dismissMutateAsync.mockClear();
    mocks.markViewedMutate.mockClear();
    mocks.loadMentorImageMock.mockReset();
    mocks.loadMentorImageMock.mockResolvedValue("/mock/fallback-mentor.png");
    mocks.dialogOnOpenChange = null;

    mocks.useMentorPersonalityMock.mockReturnValue(personality);
    mocks.useMorningBriefingMock.mockReturnValue({
      briefing: null,
      isLoading: false,
      generateBriefing: { mutateAsync: mocks.generateMutateAsync },
      dismissBriefing: { mutateAsync: mocks.dismissMutateAsync },
      markViewed: { mutate: mocks.markViewedMutate },
      isGenerating: false,
    });
  });

  it("opens and closes the mentor image dialog from the pre-briefing card and still prepares the briefing", async () => {
    render(<MorningBriefing />);

    fireEvent.click(screen.getByRole("button", { name: "Expand Lyra mentor image" }));
    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    expect(screen.getAllByText("Lyra").length).toBeGreaterThan(0);
    expect(screen.getByAltText("Lyra")).toHaveAttribute("src", "https://example.com/lyra.png");

    act(() => {
      mocks.dialogOnOpenChange?.(false);
    });
    expect(screen.queryByTestId("dialog-root")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Prepare My Briefing" }));
    expect(mocks.generateMutateAsync).toHaveBeenCalledTimes(1);
  });

  it("opens the mentor image dialog from the generated briefing and keeps existing actions working", () => {
    const onAskMore = vi.fn();

    mocks.useMorningBriefingMock.mockReturnValue({
      briefing,
      isLoading: false,
      generateBriefing: { mutateAsync: mocks.generateMutateAsync },
      dismissBriefing: { mutateAsync: mocks.dismissMutateAsync },
      markViewed: { mutate: mocks.markViewedMutate },
      isGenerating: false,
    });

    render(<MorningBriefing onAskMore={onAskMore} />);

    expect(mocks.markViewedMutate).toHaveBeenCalledWith("briefing-1");
    expect(screen.getByRole("button", { name: "Read more" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Read more" }));
    expect(screen.getByRole("button", { name: "Show less" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand Lyra mentor image" }));
    expect(screen.getAllByText("Lyra").length).toBeGreaterThan(0);
    expect(screen.queryByText("Lyra portrait")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask Lyra More" }));
    expect(onAskMore).toHaveBeenCalledWith(briefing.content, briefing.action_prompt);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(mocks.dismissMutateAsync).toHaveBeenCalledWith("briefing-1");
  });

  it("loads the canonical fallback portrait for mentors without a direct avatar url", async () => {
    mocks.useMentorPersonalityMock.mockReturnValue({
      ...personality,
      name: "The Operator",
      slug: "operator",
      avatar_url: undefined,
    });

    render(<MorningBriefing />);

    expect(mocks.loadMentorImageMock).toHaveBeenCalledWith("operator");

    fireEvent.click(screen.getByRole("button", { name: "Expand The Operator mentor image" }));
    expect(await screen.findByAltText("The Operator")).toHaveAttribute("src", "/mock/fallback-mentor.png");
    expect(screen.getAllByText("The Operator").length).toBeGreaterThan(0);
  });
});
