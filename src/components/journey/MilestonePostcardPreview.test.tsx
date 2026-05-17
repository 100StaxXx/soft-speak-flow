import type { HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MilestonePostcardPreview } from "./MilestonePostcardPreview";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      transition: _transition,
      whileHover: _whileHover,
      whileTap: _whileTap,
      ...props
    }: HTMLAttributes<HTMLDivElement> & {
      children?: ReactNode;
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
      whileHover?: unknown;
      whileTap?: unknown;
    }) => <div {...props}>{children}</div>,
  },
}));

describe("MilestonePostcardPreview", () => {
  it("renders the expanded teaser with stronger contrast and disabled text selection", () => {
    const { container } = render(
      <MilestonePostcardPreview
        currentProgress={0}
        targetPercent={25}
        milestoneTitle="Chapter one"
        chapterNumber={1}
        totalChapters={4}
        isExpanded
      />,
    );

    expect(container.firstElementChild).toHaveClass("no-text-select", "text-white");

    const narrative = screen.getByText(
      "Your companion senses adventure on the horizon. Each step forward reveals more of your cosmic tale.",
    );

    expect(narrative).toHaveClass("text-white/95", "font-medium");
    expect(narrative.parentElement).toHaveClass("bg-slate-950/65", "border-white/10");
    expect(screen.getByText("Progress to unlock")).toHaveClass("text-white/75");
  });
});
