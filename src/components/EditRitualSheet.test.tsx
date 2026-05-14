import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EditRitualSheet, type RitualData } from "./EditRitualSheet";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";

const mocks = vi.hoisted(() => ({
  getSuggestedSlots: vi.fn(),
  saveRitual: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useRitualUpdate", () => ({
  useRitualUpdate: () => ({
    saveRitual: mocks.saveRitual,
  }),
}));

vi.mock("@/hooks/useSmartScheduling", () => ({
  useSmartScheduling: () => ({
    suggestedSlots: [],
    getSuggestedSlots: mocks.getSuggestedSlots,
    isLoading: false,
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/features/quests/components/NaturalLanguageEditor", () => ({
  NaturalLanguageEditor: ({ visualStyle }: { visualStyle?: string }) => (
    <div data-testid="natural-language-editor" data-visual-style={visualStyle}>
      Quick Edit
    </div>
  ),
}));

vi.mock("@/components/Pathfinder/FrequencyPresets", () => ({
  FrequencyPresets: ({
    onFrequencyChange,
    variant,
  }: {
    onFrequencyChange: (selection: {
      frequency: string;
      customDays: number[];
      customMonthDays: number[];
      customPeriod: "week" | "month";
    }) => void;
    variant?: string;
  }) => (
    <button
      type="button"
      data-variant={variant}
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

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  SheetContent: ({
    children,
    side: _side,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; side?: string }) => <div {...props}>{children}</div>,
  SheetDescription: ({ children, ...props }: HTMLAttributes<HTMLParagraphElement> & { children: ReactNode }) => (
    <p {...props}>{children}</p>
  ),
  SheetHeader: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
  SheetTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) => (
    <h2 {...props}>{children}</h2>
  ),
  SheetFooter: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({ children, ...props }: HTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>{children}</button>
  ),
  AlertDialogCancel: ({ children, ...props }: HTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button type="button" {...props}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
    <div {...props}>{children}</div>
  ),
}));

const ritualFixture: RitualData = {
  habitId: "ritual-1",
  title: "Morning focus ritual",
  description: "Open the day with one intentional planning block.",
  difficulty: "medium",
  frequency: "custom",
  estimated_minutes: 25,
  preferred_time: "08:30",
  category: "mind",
  custom_days: [1, 3, 5],
  custom_month_days: [],
  recurrence_pattern: null,
  recurrence_days: null,
  recurrence_month_days: null,
  recurrence_custom_period: "week",
  reminder_enabled: true,
  reminder_minutes_before: 15,
};

describe("EditRitualSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveRitual.mockResolvedValue({
      queued: false,
      createdCount: 4,
      updatedCount: 1,
      deletedCount: 0,
    });
  });

  it("renders the tokenized planner shell with the core ritual fields and actions", () => {
    render(
      <EditRitualSheet
        ritual={ritualFixture}
        open
        onOpenChange={vi.fn()}
        onDelete={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByTestId("edit-ritual-sheet-shell").className).toContain("border-[hsl(var(--celestial-blue)_/_0.58)]");
    expect(screen.getByText("Edit Ritual")).toBeInTheDocument();
    expect(screen.getByText("Changes sync to all instances of this ritual.")).toBeInTheDocument();
    expect(screen.getByTestId("natural-language-editor")).toHaveAttribute("data-visual-style", "quest-soft");
    expect(screen.getByRole("button", { name: "Frequency Presets" })).toHaveAttribute("data-variant", "planner");
    expect(screen.getByDisplayValue("Morning focus ritual")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Open the day with one intentional planning block.")).toBeInTheDocument();
    expect(screen.getByText("Difficulty (affects XP reward)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8:30 AM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "25 min" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete Ritual" })).toBeEnabled();
  });

  it("applies supplied companion frosted variables to the ritual sheet portal", () => {
    const companionFrostedThemeStyle = getCompanionFrostedThemeStyle("#f5b942");

    render(
      <EditRitualSheet
        ritual={ritualFixture}
        open
        onOpenChange={vi.fn()}
        companionFrostedThemeStyle={companionFrostedThemeStyle}
      />,
    );

    expect(screen.getByTestId("edit-ritual-sheet-shell").style.getPropertyValue("--companion-frosted-primary")).toBe(
      companionFrostedThemeStyle["--companion-frosted-primary"],
    );
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

    const timeButton = screen.getByRole("button", { name: "7:00 AM" });
    expect(timeButton).toBeInTheDocument();
    const durationButton = screen.getByRole("button", { name: "45 min" });
    expect(durationButton).toBeInTheDocument();

    fireEvent.click(timeButton);
    fireEvent.change(screen.getByLabelText("Scheduled ritual time"), {
      target: { value: "08:15" },
    });
    expect(screen.getByDisplayValue("08:15")).toBeInTheDocument();

    fireEvent.click(durationButton);
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    expect(screen.getAllByRole("button", { name: "1h" })[0]).toBeInTheDocument();
  });

  it("shows Early Reminder inside Advanced Options without duplicating it", () => {
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

    const advancedTrigger = screen.getByRole("button", { name: /Advanced Options/i });
    expect(screen.getAllByText("Early Reminder")).toHaveLength(1);

    fireEvent.click(advancedTrigger);
    expect(screen.queryByText("Early Reminder")).not.toBeInTheDocument();

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
      expect(mocks.saveRitual).toHaveBeenCalledWith(
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
