import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campaignProgress: {
    currentChapter: 2,
    choiceHistory: [{ key: "steady" }],
    recapCards: [
      {
        id: "recap-1",
        chapter: 2,
        title: "Trust Trial",
        summary: "Your care rhythm held under pressure.",
        choiceKey: "steady",
        at: "2026-02-13T10:00:00.000Z",
        fromNodeTitle: "First Vow",
      },
      {
        id: "recap-2",
        chapter: 3,
        title: "Resonance Bloom",
        summary: "The habitat responded with brighter ambient color.",
        choiceKey: "steady",
        at: "2026-02-13T11:00:00.000Z",
        fromNodeTitle: "Trust Trial",
      },
      {
        id: "recap-3",
        chapter: 4,
        title: "Steady Drift Correction",
        summary: "You recovered quickly after a missed ritual.",
        choiceKey: "steady",
        at: "2026-02-13T12:00:00.000Z",
        fromNodeTitle: "Resonance Bloom",
      },
      {
        id: "recap-4",
        chapter: 5,
        title: "Arc Anchor",
        summary: "Consistency stabilized request urgency spread.",
        choiceKey: "steady",
        at: "2026-02-13T13:00:00.000Z",
        fromNodeTitle: "Steady Drift Correction",
      },
      {
        id: "recap-5",
        chapter: 6,
        title: "Calm Bridge",
        summary: "You reinforced trust before nightfall.",
        choiceKey: "steady",
        at: "2026-02-13T14:00:00.000Z",
        fromNodeTitle: "Arc Anchor",
      },
      {
        id: "recap-6",
        chapter: 7,
        title: "Signal Alignment",
        summary: "The companion initiated high-agency requests with clarity.",
        choiceKey: "steady",
        at: "2026-02-13T15:00:00.000Z",
        fromNodeTitle: "Calm Bridge",
      },
      {
        id: "recap-7",
        chapter: 8,
        title: "Long Arc Lock",
        summary: "Your weekly arc closed with strong routine integrity.",
        choiceKey: "steady",
        at: "2026-02-13T16:00:00.000Z",
        fromNodeTitle: "Signal Alignment",
      },
      {
        id: "recap-8",
        chapter: 3,
        title: "Repair Call",
        summary: "You took the repair branch and regained momentum.",
        choiceKey: "repair",
        at: "2026-02-13T17:00:00.000Z",
        fromNodeTitle: "Trust Trial",
      },
    ],
    currentNode: {
      summary: "Trust paths are opening.",
      branchOutcomes: {
        steady: "chapter_3_resonance",
        repair: "chapter_3_fragile_echo",
      },
    },
    availableBranches: [
      {
        choiceKey: "steady",
        toNodeKey: "chapter_3_resonance",
        toNodeId: "node-3",
        toNodeTitle: "Resonance Bloom",
        toNodeChapter: 3,
        unlockRules: {},
        eligible: true,
        blockedReasons: [],
      },
      {
        choiceKey: "repair",
        toNodeKey: "chapter_3_fragile_echo",
        toNodeId: "node-4",
        toNodeTitle: "Repair Echo",
        toNodeChapter: 3,
        unlockRules: { min_bond_level: 4 },
        eligible: false,
        blockedReasons: ["Bond 3.0/4.0 required"],
      },
    ],
    availableChoices: ["steady", "repair"] as string[],
  },
  advanceCampaign: {
    mutate: vi.fn(),
    isPending: false,
  },
  storyJournalProps: [] as Array<{ campaignRecaps?: Array<{ id: string }> }>,
}));

vi.mock("@/hooks/useCompanionLife", () => ({
  useCompanionLife: () => ({
    campaignProgress: mocks.campaignProgress,
    advanceCampaign: mocks.advanceCampaign,
  }),
}));

vi.mock("@/components/CompanionStoryJournal", () => ({
  CompanionStoryJournal: (props: { campaignRecaps?: Array<{ id: string }> }) => {
    mocks.storyJournalProps.push(props);
    return <div data-testid="story-journal" />;
  },
}));

vi.mock("@/components/companion/CompanionPostcards", () => ({
  CompanionPostcards: () => <div data-testid="story-postcards" />,
}));

import { StoryTab } from "./StoryTab";

describe("StoryTab", () => {
  beforeEach(() => {
    mocks.campaignProgress.currentChapter = 2;
    mocks.campaignProgress.choiceHistory = [{ key: "steady" }];
    mocks.campaignProgress.recapCards = [
      {
        id: "recap-1",
        chapter: 2,
        title: "Trust Trial",
        summary: "Your care rhythm held under pressure.",
        choiceKey: "steady",
        at: "2026-02-13T10:00:00.000Z",
        fromNodeTitle: "First Vow",
      },
      {
        id: "recap-2",
        chapter: 3,
        title: "Resonance Bloom",
        summary: "The habitat responded with brighter ambient color.",
        choiceKey: "steady",
        at: "2026-02-13T11:00:00.000Z",
        fromNodeTitle: "Trust Trial",
      },
      {
        id: "recap-3",
        chapter: 4,
        title: "Steady Drift Correction",
        summary: "You recovered quickly after a missed ritual.",
        choiceKey: "steady",
        at: "2026-02-13T12:00:00.000Z",
        fromNodeTitle: "Resonance Bloom",
      },
      {
        id: "recap-4",
        chapter: 5,
        title: "Arc Anchor",
        summary: "Consistency stabilized request urgency spread.",
        choiceKey: "steady",
        at: "2026-02-13T13:00:00.000Z",
        fromNodeTitle: "Steady Drift Correction",
      },
      {
        id: "recap-5",
        chapter: 6,
        title: "Calm Bridge",
        summary: "You reinforced trust before nightfall.",
        choiceKey: "steady",
        at: "2026-02-13T14:00:00.000Z",
        fromNodeTitle: "Arc Anchor",
      },
      {
        id: "recap-6",
        chapter: 7,
        title: "Signal Alignment",
        summary: "The companion initiated high-agency requests with clarity.",
        choiceKey: "steady",
        at: "2026-02-13T15:00:00.000Z",
        fromNodeTitle: "Calm Bridge",
      },
      {
        id: "recap-7",
        chapter: 8,
        title: "Long Arc Lock",
        summary: "Your weekly arc closed with strong routine integrity.",
        choiceKey: "steady",
        at: "2026-02-13T16:00:00.000Z",
        fromNodeTitle: "Signal Alignment",
      },
      {
        id: "recap-8",
        chapter: 3,
        title: "Repair Call",
        summary: "You took the repair branch and regained momentum.",
        choiceKey: "repair",
        at: "2026-02-13T17:00:00.000Z",
        fromNodeTitle: "Trust Trial",
      },
    ];
    mocks.campaignProgress.currentNode = {
      summary: "Trust paths are opening.",
      branchOutcomes: {
        steady: "chapter_3_resonance",
        repair: "chapter_3_fragile_echo",
      },
    };
    mocks.campaignProgress.availableBranches = [
      {
        choiceKey: "steady",
        toNodeKey: "chapter_3_resonance",
        toNodeId: "node-3",
        toNodeTitle: "Resonance Bloom",
        toNodeChapter: 3,
        unlockRules: {},
        eligible: true,
        blockedReasons: [],
      },
      {
        choiceKey: "repair",
        toNodeKey: "chapter_3_fragile_echo",
        toNodeId: "node-4",
        toNodeTitle: "Repair Echo",
        toNodeChapter: 3,
        unlockRules: { min_bond_level: 4 },
        eligible: false,
        blockedReasons: ["Bond 3.0/4.0 required"],
      },
    ];
    mocks.campaignProgress.availableChoices = ["steady", "repair"];
    mocks.advanceCampaign.isPending = false;
    mocks.advanceCampaign.mutate.mockReset();
    mocks.storyJournalProps = [];
  });

  it("renders branch choices and advances with selected branch", () => {
    render(<StoryTab />);

    expect(screen.getByText(/trust paths are opening/i)).toBeInTheDocument();
    expect(screen.getByText(/leads to resonance/i)).toBeInTheDocument();
    expect(screen.getByText(/branch readiness: 1\/2 paths available now/i)).toBeInTheDocument();
    expect(screen.getByText(/chapter 2: trust trial/i)).toBeInTheDocument();
    expect(screen.getByText(/your care rhythm held under pressure/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Steady$/i }));

    expect(mocks.advanceCampaign.mutate).toHaveBeenCalledWith("steady");
    expect(mocks.storyJournalProps[0]?.campaignRecaps?.length).toBe(8);
  });

  it("filters recap timeline by branch and can expand beyond recent entries", () => {
    render(<StoryTab />);

    expect(screen.getByRole("button", { name: /^All \(8\)$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Show All \(8\)$/i })).toBeInTheDocument();
    expect(screen.queryByText(/long arc lock/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Show All \(8\)$/i }));
    expect(screen.getByText(/long arc lock/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /repair \(1\)/i }));
    expect(screen.getByText(/you took the repair branch and regained momentum/i)).toBeInTheDocument();
    expect(screen.queryByText(/your care rhythm held under pressure/i)).not.toBeInTheDocument();
  });

  it("shows empty branch state when chapter has no choices", () => {
    mocks.campaignProgress.availableChoices = [];
    mocks.campaignProgress.availableBranches = [];
    mocks.campaignProgress.currentNode = {
      summary: "Trust paths are opening.",
      branchOutcomes: {},
    };
    mocks.campaignProgress.recapCards = [];

    render(<StoryTab />);
    expect(screen.getByText(/no explicit branch choices/i)).toBeInTheDocument();
    expect(screen.getByText(/no recap cards yet/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /advance chapter/i }));
    expect(mocks.advanceCampaign.mutate).toHaveBeenCalledWith("steady");
  });

  it("shows locked branch requirement messaging and disables locked branch action", () => {
    render(<StoryTab />);

    const repairButton = screen.getByRole("button", { name: /^Repair$/i });
    expect(repairButton).toBeDisabled();
    expect(screen.getByText(/bond 3.0\/4.0 required/i)).toBeInTheDocument();
  });
});
