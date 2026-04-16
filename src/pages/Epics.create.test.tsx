import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Epics from "./Epics";

const mocks = vi.hoisted(() => ({
  createEpic: vi.fn(),
  updateEpicStatus: vi.fn(),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: [],
    completedEpics: [],
    isLoading: false,
    createEpic: (...args: unknown[]) => mocks.createEpic(...args),
    isCreating: false,
    updateEpicStatus: (...args: unknown[]) => mocks.updateEpicStatus(...args),
  }),
}));

vi.mock("@/components/PageTransition", () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/StarfieldBackground", () => ({
  StarfieldBackground: () => <div>Starfield</div>,
}));

vi.mock("@/components/PageInfoButton", () => ({
  PageInfoButton: () => null,
}));

vi.mock("@/components/PageInfoModal", () => ({
  PageInfoModal: () => null,
}));

vi.mock("@/components/EpicCard", () => ({
  EpicCard: () => null,
}));

vi.mock("@/components/CreateEpicDialog", () => ({
  CreateEpicDialog: () => null,
}));

vi.mock("@/components/JoinEpicDialog", () => ({
  JoinEpicDialog: () => null,
}));

vi.mock("@/components/StarPathsBrowser", () => ({
  StarPathsBrowser: () => null,
}));

vi.mock("@/components/skeletons/EpicsPageSkeleton", () => ({
  EpicsPageSkeleton: () => null,
}));

vi.mock("@/components/Pathfinder", () => ({
  Pathfinder: ({
    open,
    onCreateEpic,
  }: {
    open: boolean;
    onCreateEpic: (payload: unknown) => Promise<unknown>;
  }) =>
    open ? (
      <div data-testid="mock-pathfinder">
        <button
          type="button"
          onClick={() =>
            onCreateEpic({
              title: "Pass the bar exam",
              target_days: 182,
              habits: [
                {
                  title: "Morning focus",
                  difficulty: "easy",
                  frequency: "daily",
                  custom_days: [1, 2, 3, 4, 5],
                },
              ],
            }).catch(() => undefined)
          }
        >
          Submit Campaign
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Epics page create flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the smart wizard open when campaign creation fails and only closes after success", async () => {
    mocks.createEpic.mockRejectedValueOnce(new Error("nope"));
    mocks.createEpic.mockResolvedValueOnce(undefined);

    render(<Epics />);

    fireEvent.click(screen.getByRole("button", { name: /Create Smart Epic/i }));
    expect(screen.getByTestId("mock-pathfinder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Submit Campaign/i }));

    await waitFor(() => {
      expect(mocks.createEpic).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("mock-pathfinder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Submit Campaign/i }));

    await waitFor(() => {
      expect(mocks.createEpic).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("mock-pathfinder")).not.toBeInTheDocument();
    });
  });
});
