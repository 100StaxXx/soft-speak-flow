import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkEncounterTrigger: vi.fn().mockResolvedValue({
    ok: true,
    started: true,
    resumed: false,
  }),
  addHabit: vi.fn(),
  removeHabit: vi.fn(),
  isMacSession: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: any) =>
          React.createElement(tag, props, children);
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@/hooks/useResistMode", () => ({
  useResistMode: () => ({
    habits: [
      {
        id: "habit-1",
        user_id: "user-1",
        name: "Late-night scrolling",
        icon: "📵",
        habit_theme: "distraction",
        times_resisted: 4,
        current_streak: 2,
        longest_streak: 5,
        last_resisted_at: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ],
    stats: {
      totalResisted: 4,
      successfulResists: 4,
      todayResists: 1,
      bestStreak: 5,
    },
    isLoading: false,
    isAddingHabit: false,
    isRemovingHabit: false,
    addHabit: mocks.addHabit,
    removeHabit: mocks.removeHabit,
    getHabit: vi.fn(),
  }),
}));

vi.mock("@/contexts/AstralEncounterContext", () => ({
  useAstralEncounterContext: () => ({
    checkEncounterTrigger: mocks.checkEncounterTrigger,
    isTriggeringEncounter: false,
  }),
}));

vi.mock("@/utils/platformTargets", () => ({
  isMacSession: mocks.isMacSession,
}));

vi.mock("./AddBadHabitDialog", () => ({
  AddBadHabitDialog: () => <div data-testid="add-habit-dialog" />,
}));

import { ResistModePanel } from "./ResistModePanel";

describe("ResistModePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isMacSession.mockReturnValue(false);
  });

  it("shows the Mac notice and disables Astral encounter CTAs on macOS", () => {
    mocks.isMacSession.mockReturnValue(true);

    render(<ResistModePanel />);

    expect(
      screen.getByText("Astral Encounters are only available on iPhone and iPad."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Open Soft Speak Flow on your iPhone or iPad to play Astral Encounters."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "iPhone/iPad only" })).toBeDisabled();
  });

  it("keeps Resist available on handheld sessions", async () => {
    render(<ResistModePanel />);

    expect(
      screen.queryByText("Astral Encounters are only available on iPhone and iPad."),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resist" }));

    await waitFor(() => {
      expect(mocks.checkEncounterTrigger).toHaveBeenCalledWith(
        "urge_resist",
        "habit-1",
        undefined,
        "distraction",
      );
    });
  });
});
