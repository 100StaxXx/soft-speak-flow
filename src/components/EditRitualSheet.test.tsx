import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EditRitualSheet } from "./EditRitualSheet";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
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
  FrequencyPresets: () => <div>Frequency Presets</div>,
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
});
