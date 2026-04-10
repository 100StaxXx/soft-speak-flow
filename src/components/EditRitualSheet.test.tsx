import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditRitualSheet } from "./EditRitualSheet";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  saveRitualMock: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/useRitualUpdate", () => ({
  useRitualUpdate: () => ({
    saveRitual: mocks.saveRitualMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/features/quests/components/NaturalLanguageEditor", () => ({
  NaturalLanguageEditor: () => <div>Quick Edit</div>,
}));

vi.mock("@/components/Pathfinder/FrequencyPresets", () => ({
  FrequencyPresets: ({
    onFrequencyChange,
  }: {
    onFrequencyChange: (selection: {
      frequency: string;
      customDays: number[];
      customMonthDays: number[];
      customPeriod: "week" | "month";
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onFrequencyChange({
          frequency: "5x_week",
          customDays: [0, 1, 2, 3, 4],
          customMonthDays: [],
          customPeriod: "week",
        })
      }
    >
      Frequency Presets
    </button>
  ),
}));

vi.mock("@/components/HabitDifficultySelector", () => ({
  HabitDifficultySelector: () => <div>Difficulty Selector</div>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button type="button">{children}</button>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("EditRitualSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveRitualMock.mockResolvedValue({
      queued: false,
      createdCount: 4,
      updatedCount: 1,
      deletedCount: 0,
      normalizedSchedule: {
        frequency: "5x_week",
        custom_days: [0, 1, 2, 3, 4],
        custom_month_days: null,
        customPeriod: "week",
      },
    });
  });

  it("uses the shared time and duration controls", () => {
    render(
      <EditRitualSheet
        ritual={{
          habitId: "habit-1",
          title: "Morning pages",
          description: "Write three pages",
          difficulty: "medium",
          frequency: "daily",
          preferred_time: "07:00",
          estimated_minutes: 45,
          reminder_enabled: false,
          reminder_minutes_before: 15,
          category: "mind",
        }}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const timeButtons = screen.getAllByRole("button", { name: "7:00 AM" });
    expect(timeButtons[0]).toBeInTheDocument();
    const durationButtons = screen.getAllByRole("button", { name: "45 min" });
    expect(durationButtons[0]).toBeInTheDocument();

    fireEvent.click(timeButtons[0]);
    fireEvent.change(screen.getByLabelText("Scheduled ritual time"), {
      target: { value: "08:15" },
    });
    expect(screen.getByDisplayValue("08:15")).toBeInTheDocument();

    fireEvent.click(durationButtons[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "1h" })[0]);
    expect(screen.getAllByRole("button", { name: "1h" })[0]).toBeInTheDocument();
  });

  it("shows Early Reminder above Advanced Options without duplicating it", () => {
    render(
      <EditRitualSheet
        ritual={{
          habitId: "habit-1",
          title: "Morning pages",
          description: "Write three pages",
          difficulty: "medium",
          frequency: "daily",
          preferred_time: "07:00",
          reminder_enabled: true,
          reminder_minutes_before: 15,
          category: null,
        }}
        open
        onOpenChange={vi.fn()}
      />,
    );

    const reminderLabel = screen.getByText("Early Reminder");
    const advancedTrigger = screen.getByRole("button", { name: /Advanced Options/i });
    const relation = advancedTrigger.compareDocumentPosition(reminderLabel);

    expect(relation & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(screen.getAllByText("Early Reminder")).toHaveLength(1);

    fireEvent.click(advancedTrigger);

    expect(screen.getAllByText("Early Reminder")).toHaveLength(1);
  });

  it("passes a normalized weekday schedule into the ritual save workflow", async () => {
    const onOpenChange = vi.fn();

    render(
      <EditRitualSheet
        ritual={{
          habitId: "habit-1",
          title: "Strength Training Sessions",
          description: "Lift heavy",
          difficulty: "hard",
          frequency: "weekly",
          custom_days: [0],
          preferred_time: "07:00",
          estimated_minutes: 180,
          reminder_enabled: false,
          reminder_minutes_before: 15,
          category: "body",
        }}
        open
        onOpenChange={onOpenChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Frequency Presets" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mocks.saveRitualMock).toHaveBeenCalledWith(
        expect.objectContaining({
          habitId: "habit-1",
          frequency: "5x_week",
          customDays: [0, 1, 2, 3, 4],
          customMonthDays: [],
          customPeriod: "week",
        }),
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
