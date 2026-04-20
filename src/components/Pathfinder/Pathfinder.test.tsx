import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_CAMPAIGN_LIMIT_WARNING } from "@/features/epics/constants";
import { Pathfinder } from "./Pathfinder";

const mocks = vi.hoisted(() => ({
  onCreateEpic: vi.fn(),
  trackInteraction: vi.fn(),
  success: vi.fn(),
  medium: vi.fn(),
  light: vi.fn(),
  tap: vi.fn(),
  classify: vi.fn(),
  clarifyEpic: vi.fn(),
  generateSchedule: vi.fn(),
  adjustSchedule: vi.fn(),
  toggleMilestone: vi.fn(),
  updateMilestoneDate: vi.fn(),
  resetSchedule: vi.fn(),
  setRituals: vi.fn(),
  resetClassification: vi.fn(),
  resetSuggestions: vi.fn(),
  activeEpics: [] as Array<{ id: string; status: string }>,
  aiAtEpicLimit: false,
}));

vi.mock("@/hooks/useUserAIContext", () => ({
  useUserAIContext: () => ({
    preferences: { epicDuration: 30 },
    isAtEpicLimit: mocks.aiAtEpicLimit,
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: mocks.activeEpics,
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackInteraction: (...args: unknown[]) => mocks.trackInteraction(...args),
  }),
}));

vi.mock("@/hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    success: (...args: unknown[]) => mocks.success(...args),
    medium: (...args: unknown[]) => mocks.medium(...args),
    light: (...args: unknown[]) => mocks.light(...args),
    tap: (...args: unknown[]) => mocks.tap(...args),
  }),
}));

vi.mock("@/hooks/useEpicSuggestions", () => ({
  useEpicSuggestions: () => ({
    suggestions: [],
    error: null,
    getSelectedSuggestions: () => [],
    reset: (...args: unknown[]) => mocks.resetSuggestions(...args),
  }),
}));

vi.mock("@/hooks/useEpicTemplates", () => ({
  useEpicTemplates: () => [],
}));

vi.mock("@/hooks/useJourneySchedule", () => ({
  useJourneySchedule: () => ({
    schedule: {
      feasibilityAssessment: null,
      phases: [],
      milestones: [],
      rituals: [
        {
          id: "ritual-1",
          title: "Morning focus",
          description: "Review notes",
          difficulty: "easy",
          frequency: "daily",
          customDays: [1, 2, 3, 4, 5],
          customMonthDays: [],
          customPeriod: null,
          estimatedMinutes: 30,
        },
      ],
      weeklyHoursEstimate: 5,
      executionModel: "steady",
    },
    isLoading: false,
    generateSchedule: (...args: unknown[]) => mocks.generateSchedule(...args),
    adjustSchedule: (...args: unknown[]) => mocks.adjustSchedule(...args),
    toggleMilestone: (...args: unknown[]) => mocks.toggleMilestone(...args),
    updateMilestoneDate: (...args: unknown[]) => mocks.updateMilestoneDate(...args),
    reset: (...args: unknown[]) => mocks.resetSchedule(...args),
    setRituals: (...args: unknown[]) => mocks.setRituals(...args),
    postcardCount: 0,
    maxPostcards: 3,
  }),
}));

vi.mock("@/hooks/useIntentClassifier", () => ({
  useIntentClassifier: () => ({
    classify: (...args: unknown[]) => mocks.classify(...args),
    isClassifying: false,
    clarifyEpic: (...args: unknown[]) => mocks.clarifyEpic(...args),
    reset: (...args: unknown[]) => mocks.resetClassification(...args),
  }),
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    companionLabel: "Glacieron",
    imageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__ice.png",
    focalX: null,
    focalY: null,
    element: "ice",
    usesPortraitShell: true,
  }),
}));

vi.mock("@/components/JourneyWizard/DeadlinePicker", () => ({
  DeadlinePicker: ({ onChange }: { onChange: (date: Date) => void }) => (
    <button type="button" onClick={() => onChange(new Date("2026-10-01T00:00:00.000Z"))}>
      Pick Deadline
    </button>
  ),
}));

vi.mock("@/components/JourneyWizard/TimelineView", () => ({
  TimelineView: () => <div>Timeline Preview</div>,
}));

vi.mock("@/components/JourneyWizard/AdjustmentInput", () => ({
  AdjustmentInput: () => <div>Adjustment Input</div>,
}));

vi.mock("./RitualEditor", () => ({
  RitualEditor: () => <div>Ritual Editor</div>,
}));

vi.mock("./PostcardPreview", () => ({
  PostcardPreview: () => <div>Postcard Preview</div>,
}));

vi.mock("@/features/tasks/components/EpicClarificationFlow", () => ({
  EpicClarificationFlow: () => null,
}));

describe("Pathfinder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeEpics = [];
    mocks.aiAtEpicLimit = false;
    mocks.classify.mockResolvedValue({ type: "habit" });
    mocks.clarifyEpic.mockResolvedValue({ epicContext: null });
    mocks.generateSchedule.mockResolvedValue({
      phases: [],
      milestones: [],
      rituals: [
        {
          id: "ritual-1",
          title: "Morning focus",
          description: "Review notes",
          difficulty: "easy",
          frequency: "daily",
          customDays: [1, 2, 3, 4, 5],
          customMonthDays: [],
          customPeriod: null,
          estimatedMinutes: 30,
        },
      ],
      suggestedStoryType: null,
      suggestedThemeColor: "heroic",
      feasibilityAssessment: null,
      weeklyHoursEstimate: 5,
      executionModel: "steady",
    });
  });

  it("renders the themed shell chrome when open", () => {
    render(
      <Pathfinder
        open
        onOpenChange={vi.fn()}
        onCreateEpic={(...args) => mocks.onCreateEpic(...args)}
        isCreating={false}
      />,
    );

    expect(screen.getByTestId("pathfinder-shell")).toBeInTheDocument();
    expect(screen.getByTestId("pathfinder-header")).toBeInTheDocument();
    expect(screen.getByTestId("pathfinder-progress")).toBeInTheDocument();
    expect(screen.getByTestId("pathfinder-footer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Build My Plan/i })).toBeInTheDocument();
  });

  it("does not show the campaign-limit warning when only AI context says the user is at capacity", () => {
    mocks.aiAtEpicLimit = true;

    render(
      <Pathfinder
        open
        onOpenChange={vi.fn()}
        onCreateEpic={(...args) => mocks.onCreateEpic(...args)}
        isCreating={false}
      />,
    );

    expect(screen.queryByText(ACTIVE_CAMPAIGN_LIMIT_WARNING)).not.toBeInTheDocument();
  });

  it("shows the campaign-limit warning and disables creation when planner state has five active campaigns", async () => {
    mocks.activeEpics = Array.from({ length: 5 }, (_, index) => ({
      id: `epic-${index + 1}`,
      status: "active",
    }));

    render(
      <Pathfinder
        open
        onOpenChange={vi.fn()}
        onCreateEpic={(...args) => mocks.onCreateEpic(...args)}
        isCreating={false}
      />,
    );

    expect(screen.getByText(ACTIVE_CAMPAIGN_LIMIT_WARNING)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("What's your goal?"), {
      target: { value: "Pass the bar exam" },
    });
    fireEvent.click(screen.getByText("Pick Deadline"));
    fireEvent.click(screen.getByRole("button", { name: "Build My Plan" }));

    await screen.findByRole("button", { name: /Continue with this plan/i });
    fireEvent.click(screen.getByRole("button", { name: /Continue with this plan/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Continue to Review/i }));

    fireEvent.change(await screen.findByLabelText("Your Why"), {
      target: { value: "Get licensed and start practicing." },
    });
    fireEvent.change(screen.getByLabelText("Campaign Name"), {
      target: { value: "Bar Exam Sprint" },
    });

    expect(screen.getByRole("button", { name: /Create Campaign/i })).toBeDisabled();
  });

  it("latches campaign creation immediately so rapid double taps only submit once", async () => {
    let resolveCreate: (() => void) | null = null;
    mocks.onCreateEpic.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(
      <Pathfinder
        open
        onOpenChange={vi.fn()}
        onCreateEpic={(...args) => mocks.onCreateEpic(...args)}
        isCreating={false}
      />,
    );

    expect(screen.getByTestId("pathfinder-shell")).toBeInTheDocument();
    expect(screen.getByTestId("pathfinder-footer")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("What's your goal?"), {
      target: { value: "Pass the bar exam" },
    });
    fireEvent.click(screen.getByText("Pick Deadline"));
    fireEvent.click(screen.getByRole("button", { name: "Build My Plan" }));

    await screen.findByRole("button", { name: /Continue with this plan/i });
    fireEvent.click(screen.getByRole("button", { name: /Continue with this plan/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Continue to Review/i }));

    fireEvent.change(await screen.findByLabelText("Your Why"), {
      target: { value: "Get licensed and start practicing." },
    });

    const createButton = screen.getByRole("button", { name: /Create Campaign/i });
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    expect(mocks.onCreateEpic).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Creating/i })).toBeDisabled();

    resolveCreate?.();

    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalled();
    });
  });
});
