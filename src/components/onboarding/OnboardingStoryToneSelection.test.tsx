import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingStoryToneSelection } from "./OnboardingStoryToneSelection";

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, ...props }: any) => React.createElement(tag, props, children);
      },
    },
  );

  return { motion };
});

describe("OnboardingStoryToneSelection", () => {
  it("submits the initially selected story tone", () => {
    const onComplete = vi.fn();

    render(<OnboardingStoryToneSelection onComplete={onComplete} initialTone="epic_adventure" />);

    expect(screen.getByRole("button", { name: /Epic Adventure/i })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByText(/Species and color come next/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      storyTone: "epic_adventure",
    });
  });

  it("lets the user change the tone and go back", () => {
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(
      <OnboardingStoryToneSelection
        onComplete={onComplete}
        onBack={onBack}
        initialTone="epic_adventure"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Whimsical & Playful/i }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onBack).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({
      storyTone: "whimsical_playful",
    });
  });

  it("describes the next step as color and species selection", () => {
    render(<OnboardingStoryToneSelection onComplete={vi.fn()} initialTone="epic_adventure" />);

    expect(screen.getByText("Shape The Hidden Lineage")).toBeInTheDocument();
    expect(
      screen.getByText(/Choose the spirit animal and favorite color/i),
    ).toBeInTheDocument();
  });
});
