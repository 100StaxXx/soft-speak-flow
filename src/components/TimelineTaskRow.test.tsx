import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimelineTaskRow } from "./TimelineTaskRow";

describe("TimelineTaskRow", () => {
  it("renders scheduled rows without side indicator rails", () => {
    const { container } = render(
      <TimelineTaskRow
        time="09:00"
        laneCount={3}
        laneIndex={1}
        overlapCount={2}
      >
        <div>Quest</div>
      </TimelineTaskRow>,
    );

    expect(screen.getByText("9:00a")).toHaveClass("text-muted-foreground");
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("data-timeline-lane", "1");
    expect(root).toHaveAttribute("data-timeline-lane-count", "3");
    expect(root).toHaveAttribute("data-timeline-overlap", "2");
    expect(root?.firstElementChild).toHaveClass("pt-[22px]");
    expect(root?.lastElementChild).toHaveClass("py-0");
    expect(screen.queryByTestId("timeline-duration-indicator")).not.toBeInTheDocument();
    expect(container.querySelector(".border-l")).toBeNull();
    expect(container.querySelector(".w-2.h-2.rounded-full")).toBeNull();
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
    expect(screen.queryByTestId("timeline-duration-indicator")).not.toBeInTheDocument();
  });

  it("renders marker rows with no left indicator glyphs", () => {
    const { container } = render(
      <TimelineTaskRow rowKind="marker" time="10:15" tone="now">
        <div>Now marker</div>
      </TimelineTaskRow>,
    );

    expect(screen.queryByTestId("timeline-duration-indicator")).not.toBeInTheDocument();
    const root = container.firstElementChild;
    expect(root?.firstElementChild).toHaveClass("pt-[8px]");
    expect(root?.lastElementChild).toHaveClass("py-0");
    expect(container.querySelector(".border-l")).toBeNull();
    expect(container.querySelector(".w-2.h-2.rounded-full")).toBeNull();
  });
});
