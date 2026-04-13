import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div>,
    button: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: HTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => <button {...props}>{children}</button>,
  },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: HTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ConstellationTrail", () => ({
  ConstellationTrail: () => <div data-testid="constellation-trail" />,
}));

vi.mock("@/components/EpicCheckInDrawer", () => ({
  EpicCheckInDrawer: () => <div data-testid="epic-check-in-drawer" />,
}));

vi.mock("@/components/SmartAdjustPlanDrawer", () => ({
  SmartAdjustPlanDrawer: () => null,
}));

vi.mock("@/components/JourneyDetailDrawer", () => ({
  JourneyDetailDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/journey/MilestonePostcardPreview", () => ({
  MilestonePostcardPreview: () => <div data-testid="milestone-postcard-preview" />,
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: null,
  }),
}));

vi.mock("@/hooks/useCompanionHealth", () => ({
  useCompanionHealth: () => ({
    health: null,
  }),
}));

vi.mock("@/hooks/useMilestones", () => ({
  useMilestones: () => ({
    milestones: [],
    isLoading: false,
    getProgressToNextPostcard: () => null,
    getJourneyHealth: () => null,
    backfillLegacyMilestones: {
      mutate: vi.fn(),
    },
    isBackfilling: false,
  }),
}));

import { JourneyCard } from "./JourneyCard";

const baseJourney = {
  id: "epic-1",
  user_id: "user-1",
  title: "Campaign Alpha",
  description: "A meaningful campaign",
  target_days: 14,
  start_date: "2026-02-10",
  end_date: null,
  status: "active",
  xp_reward: 140,
  progress_percentage: 25,
  epic_habits: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "share");
});

describe("JourneyCard rename", () => {
  it("renders the rename affordance for active campaigns when onRename is provided", () => {
    render(<JourneyCard journey={baseJourney} onRename={vi.fn()} />);

    expect(screen.getByLabelText("Rename campaign")).toBeInTheDocument();
  });

  it("does not render the rename affordance for completed campaigns", () => {
    render(
      <JourneyCard
        journey={{
          ...baseJourney,
          status: "completed",
        }}
        onRename={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText("Rename campaign")).not.toBeInTheDocument();
  });

  it("prefills the rename dialog and disables save for unchanged or blank values", () => {
    render(<JourneyCard journey={baseJourney} onRename={vi.fn()} />);

    fireEvent.click(screen.getByLabelText("Rename campaign"));

    const input = screen.getByLabelText("Campaign name");
    const saveButton = screen.getByRole("button", { name: "Save" });

    expect(input).toHaveValue("Campaign Alpha");
    expect(saveButton).toBeDisabled();

    fireEvent.change(input, { target: { value: "   " } });
    expect(saveButton).toBeDisabled();
  });

  it("submits the trimmed campaign title and closes the dialog on success", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);

    render(<JourneyCard journey={baseJourney} onRename={onRename} />);

    fireEvent.click(screen.getByLabelText("Rename campaign"));

    const input = screen.getByLabelText("Campaign name");
    fireEvent.change(input, { target: { value: "  Campaign Aurora  " } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(onRename).toHaveBeenCalledWith("Campaign Aurora");
    await waitFor(() => {
      expect(screen.queryByLabelText("Campaign name")).not.toBeInTheDocument();
    });
  });

  it("shares a direct invite link when the campaign has an invite code", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });

    render(
      <JourneyCard
        journey={{
          ...baseJourney,
          invite_code: "EPIC-QUEST-1234",
          is_public: true,
        }}
        onRename={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Share campaign invite"));
    });

    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
      title: "Join Campaign Alpha",
      text: expect.stringContaining("EPIC-QUEST-1234"),
      url: `${window.location.origin}/join/EPIC-QUEST-1234`,
    }));
  });
});
