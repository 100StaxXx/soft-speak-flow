import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryQuestionnaire } from "./StoryQuestionnaire";

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

  return {
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

const renderQuestionnaire = (isSubmitting = false) => {
  const onComplete = vi.fn();
  render(
    <StoryQuestionnaire
      faction="stellar"
      onComplete={onComplete}
      isSubmitting={isSubmitting}
    />,
  );

  return { onComplete };
};

const clickContinue = () => {
  fireEvent.click(screen.getByRole("button", { name: /continue/i }));
};

const answerCurrentQuestion = (answerName: RegExp | string) => {
  fireEvent.click(screen.getByRole("button", { name: answerName }));
  clickContinue();
};

describe("StoryQuestionnaire", () => {
  it("disables back, answer buttons, and continue while submitting", () => {
    const { onComplete } = renderQuestionnaire(true);

    const backButton = screen.getByRole("button", { name: /back/i });
    const firstOption = screen.getByRole("button", { name: /woman/i });
    const continueButton = screen.getByRole("button", { name: /continue/i });

    expect(backButton).toBeDisabled();
    expect(firstOption).toBeDisabled();
    expect(continueButton).toBeDisabled();

    fireEvent.click(firstOption);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("selects an answer first and advances only after continue", () => {
    renderQuestionnaire();

    const firstOption = screen.getByRole("button", { name: /woman/i });
    const continueButton = screen.getByRole("button", { name: /continue/i });

    expect(firstOption).toHaveAttribute("aria-pressed", "false");
    expect(continueButton).toBeDisabled();

    fireEvent.touchStart(firstOption);

    expect(screen.getByRole("button", { name: /woman/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
    expect(screen.getByText(/would you prefer your guide to be a man or a woman/i)).toBeInTheDocument();

    fireEvent.touchStart(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/what do you want to work on right now/i)).toBeInTheDocument();
  });

  it("restores the previous selection when moving back", () => {
    renderQuestionnaire();

    answerCurrentQuestion(/woman/i);
    fireEvent.click(screen.getByRole("button", { name: /emotions & healing/i }));
    clickContinue();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText(/what do you want to work on right now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /emotions & healing/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("dedupes touchstart and click on the final continue action", () => {
    const { onComplete } = renderQuestionnaire();

    answerCurrentQuestion(/woman/i);
    answerCurrentQuestion(/clarity & mindset/i);
    answerCurrentQuestion(/gentle & compassionate/i);
    fireEvent.click(screen.getByRole("button", { name: /clear principles and logic/i }));

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.touchStart(continueButton);
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({ questionId: "mentor_energy", optionId: "feminine_presence" }),
      expect.objectContaining({ questionId: "focus_area", optionId: "clarity_mindset" }),
      expect.objectContaining({ questionId: "guidance_tone", optionId: "gentle_compassionate" }),
      expect.objectContaining({ questionId: "progress_style", optionId: "principles_logic" }),
    ]);
  });

  it("dedupes pointerdown and click on the final continue action", () => {
    const { onComplete } = renderQuestionnaire();

    answerCurrentQuestion(/woman/i);
    answerCurrentQuestion(/clarity & mindset/i);
    answerCurrentQuestion(/gentle & compassionate/i);
    fireEvent.click(screen.getByRole("button", { name: /clear principles and logic/i }));

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.pointerDown(continueButton, { pointerType: "mouse" });
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
