import type { HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  closeRecap: vi.fn(),
  selectedRecap: null as any,
}));

vi.mock("@/hooks/useWeeklyRecap", () => ({
  useWeeklyRecap: () => ({
    isModalOpen: true,
    selectedRecap: mocks.selectedRecap,
    closeRecap: mocks.closeRecap,
  }),
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => ({ name: "The Rival" }),
}));

vi.mock("@/utils/imageDownload", () => ({
  downloadImage: vi.fn(),
}));

vi.mock("html-to-image", () => ({
  toPng: vi.fn(),
}));

type MotionProps<T> = HTMLAttributes<T> & {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
};

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: MotionProps<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, initial: _initial, animate: _animate, transition: _transition, ...props }: MotionProps<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
    p: ({ children, initial: _initial, animate: _animate, transition: _transition, ...props }: MotionProps<HTMLParagraphElement>) => (
      <p {...props}>{children}</p>
    ),
  },
}));

import { WeeklyRecapModal } from "./WeeklyRecapModal";

const createRecap = (overrides: Partial<typeof mocks.selectedRecap> = {}) => ({
  id: "recap-1",
  user_id: "user-1",
  week_start_date: "2026-05-04",
  week_end_date: "2026-05-10",
  mood_data: {
    morning: [],
    evening: [],
    trend: "stable",
  },
  gratitude_themes: [],
  win_highlights: [],
  stats: {
    checkIns: 2,
    reflections: 0,
    quests: 7,
    habits: 7,
  },
  mentor_insight: null,
  mentor_story: null,
  created_at: "2026-05-11T00:00:00.000Z",
  viewed_at: null,
  ...overrides,
});

describe("WeeklyRecapModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedRecap = createRecap();
  });

  it("prefers the full mentor story when a preview insight also exists", () => {
    mocks.selectedRecap = createRecap({
      mentor_insight: "Preview text that should not appear in the modal.",
      mentor_story: "Full mentor story appears here.\n\nThis sentence only exists in the complete recap.",
    });

    render(<WeeklyRecapModal />);

    expect(screen.getByText("Full mentor story appears here.")).toBeInTheDocument();
    expect(screen.getByText("This sentence only exists in the complete recap.")).toBeInTheDocument();
    expect(screen.queryByText("Preview text that should not appear in the modal.")).not.toBeInTheDocument();
  });

  it("falls back to the mentor insight when no full story exists", () => {
    mocks.selectedRecap = createRecap({
      mentor_insight: "Fallback insight appears for an older recap.",
      mentor_story: null,
    });

    render(<WeeklyRecapModal />);

    expect(screen.getByText("Fallback insight appears for an older recap.")).toBeInTheDocument();
  });
});
