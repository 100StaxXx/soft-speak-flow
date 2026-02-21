import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimedCaptions } from "./TimedCaptions";

const transcript = [
  { word: "Stay", start: 0, end: 0.5 },
  { word: "Focused", start: 0.5, end: 1.0 },
  { word: "Today", start: 1.2, end: 1.6 },
];

describe("TimedCaptions timing behavior", () => {
  it("moves highlight to the next word at an exact boundary", () => {
    const { rerender } = render(
      <TimedCaptions transcript={transcript} currentTime={0.49} />,
    );

    expect(screen.getByText("Stay")).toHaveClass("bg-stardust-gold/30");
    expect(screen.getByText("Focused")).not.toHaveClass("bg-stardust-gold/30");

    rerender(<TimedCaptions transcript={transcript} currentTime={0.5} />);

    expect(screen.getByText("Stay")).not.toHaveClass("bg-stardust-gold/30");
    expect(screen.getByText("Focused")).toHaveClass("bg-stardust-gold/30");
  });

  it("shows no active highlight during gaps", () => {
    render(<TimedCaptions transcript={transcript} currentTime={1.1} />);

    expect(screen.getByText("Stay")).not.toHaveClass("bg-stardust-gold/30");
    expect(screen.getByText("Focused")).not.toHaveClass("bg-stardust-gold/30");
    expect(screen.getByText("Today")).not.toHaveClass("bg-stardust-gold/30");
  });

  it("clears highlight after the final word ends", () => {
    render(<TimedCaptions transcript={transcript} currentTime={1.6} />);

    expect(screen.getByText("Stay")).not.toHaveClass("bg-stardust-gold/30");
    expect(screen.getByText("Focused")).not.toHaveClass("bg-stardust-gold/30");
    expect(screen.getByText("Today")).not.toHaveClass("bg-stardust-gold/30");
  });
});
