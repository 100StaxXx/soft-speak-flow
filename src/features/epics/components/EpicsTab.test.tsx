import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useEpicsMock: vi.fn(),
  dismissTutorialMock: vi.fn(),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => mocks.useEpicsMock(),
}));

vi.mock("@/hooks/useFirstTimeModal", () => ({
  useFirstTimeModal: () => ({
    showModal: false,
    dismissModal: mocks.dismissTutorialMock,
  }),
}));

vi.mock("@/components/JourneyCard", () => ({
  JourneyCard: ({ journey }: { journey: { title: string } }) => <div>{journey.title}</div>,
}));

vi.mock("@/components/Pathfinder", () => ({
  Pathfinder: () => null,
}));

vi.mock("@/components/JoinEpicDialog", () => ({
  JoinEpicDialog: () => null,
}));

vi.mock("@/components/EpicsTutorialModal", () => ({
  EpicsTutorialModal: () => null,
}));

vi.mock("@/components/CampaignCreatedAnimation", () => ({
  CampaignCreatedAnimation: () => null,
}));

vi.mock("./CampaignEmptyStateModal", () => ({
  CampaignEmptyStateModal: () => null,
}));

import { ACTIVE_CAMPAIGN_LIMIT } from "@/features/epics/constants";
import { EpicsTab } from "./EpicsTab";

const buildCampaign = (id: string) => ({
  id,
  title: `Campaign ${id}`,
  status: "active" as const,
});

describe("EpicsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useEpicsMock.mockReturnValue({
      activeEpics: [],
      completedEpics: [],
      isLoading: false,
      createEpic: vi.fn(),
      isCreating: false,
      updateEpicStatus: vi.fn(),
    });
  });

  it("keeps the add-campaign affordance visible when the user is one campaign under the limit", () => {
    mocks.useEpicsMock.mockReturnValue({
      activeEpics: Array.from({ length: ACTIVE_CAMPAIGN_LIMIT - 1 }, (_, index) =>
        buildCampaign(String(index + 1))
      ),
      completedEpics: [],
      isLoading: false,
      createEpic: vi.fn(),
      isCreating: false,
      updateEpicStatus: vi.fn(),
    });

    render(<EpicsTab />);

    expect(screen.getByLabelText(/Create campaign/i)).toBeInTheDocument();
  });

  it("hides the add-campaign affordance once the user reaches the active campaign limit", () => {
    mocks.useEpicsMock.mockReturnValue({
      activeEpics: Array.from({ length: ACTIVE_CAMPAIGN_LIMIT }, (_, index) =>
        buildCampaign(String(index + 1))
      ),
      completedEpics: [],
      isLoading: false,
      createEpic: vi.fn(),
      isCreating: false,
      updateEpicStatus: vi.fn(),
    });

    render(<EpicsTab />);

    expect(screen.queryByLabelText(/Create campaign/i)).not.toBeInTheDocument();
  });
});
