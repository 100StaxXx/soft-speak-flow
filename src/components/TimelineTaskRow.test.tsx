import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimelineTaskRow } from "./TimelineTaskRow";

describe("TimelineTaskRow", () => {
  it("renders a wide lane-aware duration rail for scheduled tasks", () => {
    render(
      <TimelineTaskRow
        time="09:00"
        durationMinutes={45}
        laneCount={3}
        laneIndex={1}
        overlapCount={2}
      >
        <div>Quest</div>
      </TimelineTaskRow>,
    );

    expect(screen.getByText("9:00a")).toHaveClass("text-muted-foreground");

    const indicator = screen.getByTestId("timeline-duration-indicator");
    expect(indicator).toHaveAttribute("data-duration-minutes", "45");
    expect(indicator).toHaveAttribute("data-duration-height", "27");
    expect(indicator).toHaveAttribute("data-duration-width", "18");
    expect(indicator).toHaveAttribute("data-duration-lane-count", "3");
    expect(indicator).toHaveAttribute("data-duration-lane-index", "1");
    expect(indicator).toHaveClass("border-primary/45");
  });

  it("keeps override preview styling unchanged in default tone", () => {
    render(
      <TimelineTaskRow time="09:00" overrideTime="10:15">
        <div>Quest</div>
      </TimelineTaskRow>,
    );

    expect(screen.getByText("10:15a")).toHaveClass("text-primary", "font-bold");
  });

  it("applies yellow accent styling for the now tone", () => {
    render(
      <TimelineTaskRow time="10:15" tone="now" laneCount={2} laneIndex={1}>
        <div>Now</div>
      </TimelineTaskRow>,
    );

    expect(screen.getByText("10:15a")).toHaveClass("text-stardust-gold", "font-semibold");
    expect(screen.getByTestId("timeline-duration-indicator")).toHaveClass("border-stardust-gold/45");
  });

  it("keeps marker rows lightweight without the wide duration rail", () => {
    const { container } = render(
      <TimelineTaskRow rowKind="marker" time="10:15" tone="now">
        <div>Now marker</div>
      </TimelineTaskRow>,
    );

    expect(screen.queryByTestId("timeline-duration-indicator")).not.toBeInTheDocument();
    const dot = container.querySelector(".w-2.h-2.rounded-full");
    expect(dot).not.toBeNull();
  });
});
