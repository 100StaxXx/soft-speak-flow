import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TutorialCompletionOverlay } from "./TutorialCompletionOverlay";

const mocks = vi.hoisted(() => ({
  confetti: vi.fn(),
  prefersReducedMotion: false,
}));

vi.mock("canvas-confetti", () => ({
  default: mocks.confetti,
}));

vi.mock("framer-motion", () => {
  const createMotionComponent =
    (tag: keyof React.JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & Record<string, unknown>>(
      ({ children, initial, animate, exit, transition, ...props }, ref) =>
        React.createElement(tag, { ...props, ref }, children),
    );

  return {
    motion: {
      div: createMotionComponent("div"),
      section: createMotionComponent("section"),
      span: createMotionComponent("span"),
    },
    useReducedMotion: () => mocks.prefersReducedMotion,
  };
});

const baseProps = {
  title: "You're ready.",
  body: "Your Companion is awake, your first path is set, and today has somewhere to go.",
  highlights: ["Path created", "Companion hatched", "Next step ready"],
  mentorLine: "Sage: I'll be here when you need the next step.",
  ctaLabel: "Start my journey",
  onComplete: vi.fn(),
};

describe("TutorialCompletionOverlay", () => {
  beforeEach(() => {
    mocks.confetti.mockClear();
    mocks.prefersReducedMotion = false;
    baseProps.onComplete.mockClear();
  });

  it("renders the completion copy and calls the final CTA", () => {
    render(<TutorialCompletionOverlay {...baseProps} />);

    expect(screen.getByRole("dialog", { name: "You're ready." })).toBeInTheDocument();
    expect(screen.getByText(baseProps.body)).toBeInTheDocument();
    expect(screen.getByText("Path created")).toBeInTheDocument();
    expect(screen.getByText("Companion hatched")).toBeInTheDocument();
    expect(screen.getByText("Next step ready")).toBeInTheDocument();
    expect(screen.getByText("Sage: I'll be here when you need the next step.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Start my journey/i }));

    expect(baseProps.onComplete).toHaveBeenCalledTimes(1);
  });

  it("moves focus to the CTA and restores prior focus on unmount", async () => {
    const previousButton = document.createElement("button");
    previousButton.textContent = "Previous action";
    document.body.appendChild(previousButton);
    previousButton.focus();

    const { unmount } = render(<TutorialCompletionOverlay {...baseProps} />);
    const cta = screen.getByRole("button", { name: /Start my journey/i });

    await waitFor(() => {
      expect(document.activeElement).toBe(cta);
    });

    unmount();

    expect(document.activeElement).toBe(previousButton);
    previousButton.remove();
  });

  it("keeps tab focus inside the dialog", async () => {
    render(<TutorialCompletionOverlay {...baseProps} />);
    const cta = screen.getByRole("button", { name: /Start my journey/i });

    await waitFor(() => {
      expect(document.activeElement).toBe(cta);
    });

    expect(fireEvent.keyDown(document, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(cta);
  });

  it("fires a small confetti burst when motion is allowed", async () => {
    render(<TutorialCompletionOverlay {...baseProps} />);

    await waitFor(() => {
      expect(mocks.confetti).toHaveBeenCalledTimes(1);
    });
    expect(mocks.confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 42,
        disableForReducedMotion: true,
      }),
    );
  });

  it("suppresses confetti when reduced motion is requested", async () => {
    mocks.prefersReducedMotion = true;

    render(<TutorialCompletionOverlay {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "You're ready." })).toBeInTheDocument();
    });
    expect(mocks.confetti).not.toHaveBeenCalled();
  });
});
