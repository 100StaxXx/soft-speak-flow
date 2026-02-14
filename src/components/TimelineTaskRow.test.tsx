import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimelineTaskRow } from "./TimelineTaskRow";

describe("TimelineTaskRow", () => {
  it("uses default muted styling for regular time labels", () => {
    const { container } = render(
      <TimelineTaskRow time="09:00">
        <div>Quest</div>
      </TimelineTaskRow>,
    );

    expect(screen.getByText("9:00a")).toHaveClass("text-muted-foreground");
    expect(screen.getByTestId("timeline-duration-indicator")).toHaveClass("bg-primary/30");

    const dot = container.querySelector(".w-2.h-2.rounded-full");
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("bg-primary/70");
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
    const { container } = render(
      <TimelineTaskRow time="10:15" tone="now">
        <div>Now</div>
      </TimelineTaskRow>,
    );

    expect(screen.getByText("10:15a")).toHaveClass("text-stardust-gold", "font-semibold");
    expect(screen.getByTestId("timeline-duration-indicator")).toHaveClass("bg-stardust-gold/45");

    const dot = container.querySelector(".w-2.h-2.rounded-full");
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("bg-stardust-gold");
  });
});
