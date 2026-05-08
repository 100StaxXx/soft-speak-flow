import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeEpics: [] as Array<Record<string, unknown>>,
  updateEpicMock: vi.fn(),
  deleteEpicMock: vi.fn(),
  deleteCampaignRitualMock: vi.fn(),
  createCampaignRitualMock: vi.fn(),
  editRitualSheetMock: vi.fn(),
  fromMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useEpics", () => ({
  useEpics: () => ({
    activeEpics: mocks.activeEpics,
    updateEpic: (...args: unknown[]) => mocks.updateEpicMock(...args),
    deleteEpic: (...args: unknown[]) => mocks.deleteEpicMock(...args),
    deleteCampaignRitual: (...args: unknown[]) => mocks.deleteCampaignRitualMock(...args),
    createCampaignRitual: (...args: unknown[]) => mocks.createCampaignRitualMock(...args),
  }),
}));

vi.mock("@/components/RescheduleDrawer", () => ({
  RescheduleDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/EditRitualSheet", () => ({
  EditRitualSheet: (props: Record<string, unknown>) => {
    mocks.editRitualSheetMock(props);
    return props.open ? <div data-testid="edit-ritual-sheet">Editing ritual</div> : null;
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mocks.fromMock(...args),
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: Object.assign(
    vi.fn(),
    {
      success: (...args: unknown[]) => mocks.toastSuccessMock(...args),
      error: (...args: unknown[]) => mocks.toastErrorMock(...args),
    },
  ),
}));

import { EditCampaignSheet } from "./EditCampaignSheet";
import { DIFFICULTY_COLORS } from "./quest-shared";

const expectElementToIncludeClasses = (element: HTMLElement, classes: string) => {
  for (const token of classes.split(" ").filter(Boolean)) {
    expect(element.className).toContain(token);
  }
};

const baseEpic = {
  id: "epic-1",
  title: "Campaign Aurora",
  description: "A focused campaign",
  target_days: 30,
  start_date: "2026-03-01",
  end_date: "2026-03-31",
  epic_habits: [
    {
      habit_id: "habit-1",
      habits: {
        id: "habit-1",
        title: "Morning focus",
        description: "Start with intention",
        difficulty: "easy",
        frequency: "daily",
        custom_days: [],
        custom_month_days: null,
        preferred_time: null,
        estimated_minutes: 15,
        category: "mind" as const,
      },
    },
  ],
};

const renderSheet = (props?: Partial<React.ComponentProps<typeof EditCampaignSheet>>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EditCampaignSheet
        epic={baseEpic}
        open={true}
        onOpenChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>,
  );
};

describe("EditCampaignSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeEpics = [baseEpic];
    mocks.updateEpicMock.mockResolvedValue(undefined);
    mocks.deleteEpicMock.mockResolvedValue(undefined);
    mocks.deleteCampaignRitualMock.mockResolvedValue(undefined);
    mocks.createCampaignRitualMock.mockResolvedValue(undefined);
    mocks.fromMock.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });
  });

  it("prefills campaign fields and disables save until changes are made", () => {
    renderSheet();

    expect(screen.getByLabelText("Campaign name")).toHaveValue("Campaign Aurora");
    expect(screen.getByLabelText("Description")).toHaveValue("A focused campaign");
    expectElementToIncludeClasses(
      screen.getByTestId("edit-campaign-sheet-shell"),
      "fixed border-primary/55 text-foreground",
    );
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("saves title and description changes through updateEpic", async () => {
    renderSheet();

    fireEvent.change(screen.getByLabelText("Campaign name"), {
      target: { value: "Campaign Nova" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A better description" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mocks.updateEpicMock).toHaveBeenCalledWith({
        epicId: "epic-1",
        updates: {
          title: "Campaign Nova",
          description: "A better description",
        },
      });
    });
  });

  it("opens the ritual editor when a ritual row is clicked", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: /Morning focus/i }));

    await waitFor(() => {
      expect(screen.getByTestId("edit-ritual-sheet")).toBeInTheDocument();
    });
    expect(mocks.editRitualSheetMock).toHaveBeenLastCalledWith(expect.objectContaining({
      open: true,
      ritual: expect.objectContaining({
        habitId: "habit-1",
        title: "Morning focus",
      }),
    }));
  });

  it("deletes rituals through useEpics campaign ritual cleanup", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: /Morning focus/i }));

    await waitFor(() => {
      expect(screen.getByTestId("edit-ritual-sheet")).toBeInTheDocument();
    });

    const props = mocks.editRitualSheetMock.mock.lastCall?.[0] as {
      onDelete: (habitId: string) => Promise<void>;
    };
    await act(async () => {
      await props.onDelete("habit-1");
    });

    expect(mocks.deleteCampaignRitualMock).toHaveBeenCalledWith({
      epicId: "epic-1",
      habitId: "habit-1",
    });
    expect(mocks.fromMock).not.toHaveBeenCalled();
  });

  it("adds a new ritual through createCampaignRitual", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Add ritual" }));
    expectElementToIncludeClasses(
      screen.getByText("Medium").closest("label") as HTMLElement,
      DIFFICULTY_COLORS.medium.difficultyActive,
    );
    fireEvent.change(screen.getByLabelText("Ritual name"), {
      target: { value: "Evening review" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save ritual" }));

    await waitFor(() => {
      expect(mocks.createCampaignRitualMock).toHaveBeenCalledWith({
        epicId: "epic-1",
        title: "Evening review",
        difficulty: "medium",
        frequency: "daily",
        customDays: [],
        preferredTime: null,
        estimatedMinutes: null,
      });
    });
  });

  it("passes time and duration when adding a new ritual", async () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Add ritual" }));
    fireEvent.change(screen.getByLabelText("Ritual name"), {
      target: { value: "Evening review" },
    });

    fireEvent.click(screen.getByRole("button", { name: "No time" }));
    fireEvent.change(screen.getByLabelText("New ritual time"), {
      target: { value: "19:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "No duration" }));
    fireEvent.click(screen.getByRole("button", { name: "45m" }));

    fireEvent.click(screen.getByRole("button", { name: "Save ritual" }));

    await waitFor(() => {
      expect(mocks.createCampaignRitualMock).toHaveBeenCalledWith({
        epicId: "epic-1",
        title: "Evening review",
        difficulty: "medium",
        frequency: "daily",
        customDays: [],
        preferredTime: "19:00",
        estimatedMinutes: 45,
      });
    });
  });

  it("confirms and deletes the campaign through deleteEpic", async () => {
    renderSheet();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete campaign" })[0]);
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete campaign" }));

    await waitFor(() => {
      expect(mocks.deleteEpicMock).toHaveBeenCalledWith({ epicId: "epic-1" });
    });
  });
});
