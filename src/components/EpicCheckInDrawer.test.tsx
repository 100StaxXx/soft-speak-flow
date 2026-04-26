import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EpicCheckInDrawer } from "./EpicCheckInDrawer";

const mocks = vi.hoisted(() => ({
  createCampaignRitualMock: vi.fn(),
  surfaceHabitMock: vi.fn(),
  toggleTaskMock: vi.fn(),
  triggerRitualCompleteMock: vi.fn().mockResolvedValue(undefined),
  drawerRootProps: [] as Array<Record<string, unknown>>,
}));

let applyCreatedHabit: ((title: string) => void) | null = null;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    createCampaignRitual: (...args: unknown[]) => mocks.createCampaignRitualMock(...args),
  }),
}));

vi.mock("@/hooks/useHabitSurfacing", () => ({
  useHabitSurfacing: () => ({
    surfacedHabits: [],
    surfaceHabit: mocks.surfaceHabitMock,
  }),
}));

vi.mock("@/hooks/useTaskMutations", () => ({
  useTaskMutations: () => ({
    toggleTask: mocks.toggleTaskMock,
  }),
}));

vi.mock("@/hooks/useLivingCompanion", () => ({
  useLivingCompanionSafe: () => ({
    triggerRitualComplete: mocks.triggerRitualCompleteMock,
  }),
}));

vi.mock("@/components/EditRitualSheet", () => ({
  EditRitualSheet: () => null,
}));

vi.mock("@/components/HabitDifficultySelector", () => ({
  HabitDifficultySelector: () => <div data-testid="habit-difficulty-selector" />,
}));

vi.mock("@/components/FrequencyPicker", () => ({
  FrequencyPicker: () => <div data-testid="frequency-picker" />,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => {
    mocks.drawerRootProps.push(props);
    return <div>{children}</div>;
  },
  DrawerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("EpicCheckInDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drawerRootProps.length = 0;
    applyCreatedHabit = null;
  });

  const Harness = () => {
    const [habits, setHabits] = useState([
      {
        id: "habit-1",
        title: "Daily Hydration",
        difficulty: "easy",
        frequency: "daily",
        custom_days: [0, 1, 2, 3, 4, 5, 6],
        custom_month_days: null,
      },
    ]);

    applyCreatedHabit = (title: string) => {
      setHabits((current) => [
        ...current,
        {
          id: `habit-${current.length + 1}`,
          title,
          difficulty: "medium",
          frequency: "daily",
          custom_days: [0, 1, 2, 3, 4, 5, 6],
          custom_month_days: null,
        },
      ]);
    };

    return (
      <EpicCheckInDrawer
        epicId="epic-1"
        habits={habits}
        isActive={true}
        renderTrigger={() => <button type="button">Open drawer</button>}
      />
    );
  };

  const renderSubject = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
  };

  it("disables Vaul input repositioning for the ritual drawer", () => {
    renderSubject();

    expect(mocks.drawerRootProps[0]).toMatchObject({
      repositionInputs: false,
    });
  });

  it("surfaces a newly added ritual as soon as the shared create mutation succeeds", async () => {
    mocks.createCampaignRitualMock.mockImplementation(async ({ title }: { title: string }) => {
      applyCreatedHabit?.(title);
      return { queued: false };
    });

    renderSubject();

    fireEvent.click(screen.getByRole("button", { name: "Add New Ritual" }));
    fireEvent.change(screen.getByPlaceholderText("New ritual name..."), {
      target: { value: "Evening Walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Ritual" }));

    await waitFor(() => {
      expect(screen.getByText("Evening Walk")).toBeInTheDocument();
    });

    expect(mocks.createCampaignRitualMock).toHaveBeenCalledWith(
      expect.objectContaining({
        epicId: "epic-1",
        title: "Evening Walk",
      }),
    );
    expect(screen.queryByPlaceholderText("New ritual name...")).not.toBeInTheDocument();
  });

  it("keeps the add form open when creating the ritual fails", async () => {
    mocks.createCampaignRitualMock.mockRejectedValue(new Error("Failed to add ritual"));

    renderSubject();

    fireEvent.click(screen.getByRole("button", { name: "Add New Ritual" }));
    fireEvent.change(screen.getByPlaceholderText("New ritual name..."), {
      target: { value: "Evening Walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Ritual" }));

    await waitFor(() => {
      expect(mocks.createCampaignRitualMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByDisplayValue("Evening Walk")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Ritual" })).toBeInTheDocument();
  });
});
