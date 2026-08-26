import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryQuestionnaire, type OnboardingAnswer } from "./StoryQuestionnaire";

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

const renderQuestionnaire = (
  isSubmitting = false,
  initialAnswers: OnboardingAnswer[] = [],
  faction: "starfall" | "void" | "stellar" = "stellar",
) => {
  const onComplete = vi.fn();
  render(
    <StoryQuestionnaire
      faction={faction}
      onComplete={onComplete}
      isSubmitting={isSubmitting}
      initialAnswers={initialAnswers}
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
    const firstOption = screen.getByRole("button", { name: /^amale$/i });
    const continueButton = screen.getByRole("button", { name: /continue/i });

    expect(backButton).toBeDisabled();
    expect(firstOption).toBeDisabled();
    expect(continueButton).toBeDisabled();

    fireEvent.click(firstOption);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("selects an answer first and advances only after continue", () => {
    renderQuestionnaire();

    const firstOption = screen.getByRole("button", { name: /female/i });
    const continueButton = screen.getByRole("button", { name: /continue/i });

    expect(firstOption).toHaveAttribute("aria-pressed", "false");
    expect(continueButton).toBeDisabled();

    fireEvent.touchStart(firstOption);

    expect(screen.getByRole("button", { name: /female/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
    expect(screen.getByText(/a faithful path begins with the dignity/i)).toBeInTheDocument();

    fireEvent.touchStart(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/would you prefer your guide to be a man or a woman/i)).toBeInTheDocument();
  });

  it("ignores a delayed press from the previous question after advancing", () => {
    renderQuestionnaire();

    fireEvent.click(screen.getByRole("button", { name: /female/i }));
    const firstQuestionContinue = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(firstQuestionContinue);

    expect(screen.getByText(/would you prefer your guide to be a man or a woman/i)).toBeInTheDocument();

    fireEvent.click(firstQuestionContinue);

    expect(screen.getByText(/would you prefer your guide to be a man or a woman/i)).toBeInTheDocument();
    expect(screen.queryByText(/where would you most like to grow right now/i)).not.toBeInTheDocument();
  });

  it("falls back instead of crashing when a runtime faction value is unrecognized", () => {
    renderQuestionnaire(false, [], "legacy_faction" as any);

    expect(screen.getByText(/a faithful path begins with the dignity/i)).toBeInTheDocument();
  });

  it("restores the previous selection when moving back", () => {
    renderQuestionnaire();

    answerCurrentQuestion(/female/i);
    answerCurrentQuestion(/woman/i);
    fireEvent.click(screen.getByRole("button", { name: /peace & emotional healing/i }));
    clickContinue();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText(/where would you most like to grow right now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /peace & emotional healing/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("resumes at the next unanswered question when initial answers are provided", () => {
    renderQuestionnaire(false, [
      {
        questionId: "visual_persona",
        optionId: "visual_persona_female",
        answer: "Female",
        tags: ["visual_persona_female"],
      },
      {
        questionId: "mentor_energy",
        optionId: "feminine_presence",
        answer: "Woman",
        tags: ["feminine_preference"],
      },
      {
        questionId: "focus_area",
        optionId: "clarity_mindset",
        answer: "Clarity & mindset",
        tags: ["calm", "discipline"],
      },
    ]);

    expect(screen.getByText(/how do you want guidance to feel/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/where would you most like to grow right now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prayer & spiritual attention/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("aligns legacy saved answers by question id instead of index", () => {
    renderQuestionnaire(false, [
      {
        questionId: "mentor_energy",
        optionId: "feminine_presence",
        answer: "Woman",
        tags: ["feminine_preference"],
      },
      {
        questionId: "focus_area",
        optionId: "clarity_mindset",
        answer: "Clarity & mindset",
        tags: ["calm", "discipline"],
      },
    ]);

    expect(screen.getByText(/a faithful path begins with the dignity/i)).toBeInTheDocument();
    answerCurrentQuestion(/prefer not to say/i);
    expect(screen.getByText(/would you prefer your guide to be a man or a woman/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /woman/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("dedupes touchstart and click on the final continue action", () => {
    const { onComplete } = renderQuestionnaire();

    answerCurrentQuestion(/female/i);
    answerCurrentQuestion(/woman/i);
    answerCurrentQuestion(/prayer & spiritual attention/i);
    answerCurrentQuestion(/gentle & compassionate/i);
    answerCurrentQuestion(/clear principles and logic/i);
    fireEvent.click(screen.getByRole("button", { name: /i work a 9-5/i }));

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.touchStart(continueButton);
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({ questionId: "visual_persona", optionId: "visual_persona_female" }),
      expect.objectContaining({ questionId: "mentor_energy", optionId: "feminine_presence" }),
      expect.objectContaining({ questionId: "focus_area", optionId: "clarity_mindset" }),
      expect.objectContaining({ questionId: "guidance_tone", optionId: "gentle_compassionate" }),
      expect.objectContaining({ questionId: "progress_style", optionId: "principles_logic" }),
      expect.objectContaining({ questionId: "schedule_archetype", optionId: "nine_to_five" }),
    ]);
  });

  it("dedupes pointerdown and click on the final continue action", () => {
    const { onComplete } = renderQuestionnaire();

    answerCurrentQuestion(/female/i);
    answerCurrentQuestion(/woman/i);
    answerCurrentQuestion(/prayer & spiritual attention/i);
    answerCurrentQuestion(/gentle & compassionate/i);
    answerCurrentQuestion(/clear principles and logic/i);
    fireEvent.click(screen.getByRole("button", { name: /i work a 9-5/i }));

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.pointerDown(continueButton, { pointerType: "mouse" });
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
