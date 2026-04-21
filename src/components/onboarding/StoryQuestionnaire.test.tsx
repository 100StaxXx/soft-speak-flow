import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
};

const answerAndContinue = (answerName: RegExp | string) => {
  answerCurrentQuestion(answerName);
  clickContinue();
};

const expectVisibleOptionCountAtMost = (maxOptions: number) => {
  expect(screen.getAllByTestId("questionnaire-option").length).toBeLessThanOrEqual(maxOptions);
};

describe("StoryQuestionnaire", () => {
  it("disables back, answer buttons, and continue while submitting", () => {
    const { onComplete } = renderQuestionnaire(true);

    const backButton = screen.getByRole("button", { name: /back/i });
    const firstOption = screen.getByRole("button", { name: /feminine energy/i });
    const continueButton = screen.getByRole("button", { name: /continue/i });

    expect(backButton).toBeDisabled();
    expect(firstOption).toBeDisabled();
    expect(continueButton).toBeDisabled();

    fireEvent.click(firstOption);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("shows no more than four options per screen and advances only after continue", () => {
    renderQuestionnaire();

    const firstOption = screen.getByRole("button", { name: /feminine energy/i });
    const continueButton = screen.getByRole("button", { name: /continue/i });

    expectVisibleOptionCountAtMost(4);
    expect(firstOption).toHaveAttribute("aria-pressed", "false");
    expect(continueButton).toBeDisabled();

    fireEvent.touchStart(firstOption);

    expect(screen.getByRole("button", { name: /feminine energy/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
    expect(screen.getByText(/what kind of guide energy feels right for you/i)).toBeInTheDocument();

    fireEvent.touchStart(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText(/what kind of help do you need most right now/i)).toBeInTheDocument();
    expectVisibleOptionCountAtMost(4);
  });

  it("restores the previous selection when moving back", () => {
    renderQuestionnaire();

    answerAndContinue(/feminine energy/i);
    answerCurrentQuestion(/gentle routines and self-trust/i);
    clickContinue();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByText(/what kind of help do you need most right now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /gentle routines and self-trust/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
  });

  it("adds a fifth clarity question only for unresolved clarity recommendations", async () => {
    const { onComplete } = renderQuestionnaire();

    answerAndContinue(/it doesn't matter/i);
    expectVisibleOptionCountAtMost(4);

    answerAndContinue(/clarity, signal, and perspective/i);
    expectVisibleOptionCountAtMost(4);

    answerAndContinue(/composed and polished/i);
    expectVisibleOptionCountAtMost(4);

    answerCurrentQuestion(/help me act in line with my standards/i);
    clickContinue();

    expect(screen.getByText(/what kind of clarity cuts through best for you/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("questionnaire-option")).toHaveLength(3);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /pattern strategy/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /pattern strategy/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continue/i })).not.toBeDisabled();
    });

    clickContinue();

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith([
        expect.objectContaining({ questionId: "mentor_energy", optionId: "either_works" }),
        expect.objectContaining({ questionId: "focus_area", optionId: "clarity_signal" }),
        expect.objectContaining({ questionId: "guidance_tone", optionId: "composed_polished" }),
        expect.objectContaining({ questionId: "progress_style", optionId: "identity_alignment" }),
        expect.objectContaining({ questionId: "clarity_lens", optionId: "pattern_strategy" }),
      ]);
    });
  });

  it("adds a fifth pressure question only for unresolved direct recommendations", () => {
    renderQuestionnaire();

    answerAndContinue(/masculine energy/i);
    answerAndContinue(/execution, pressure, and accountability/i);
    answerAndContinue(/direct and challenging/i);
    answerCurrentQuestion(/push me to execute and stop stalling/i);
    clickContinue();

    expect(screen.getByText(/what kind of pressure works best on you/i)).toBeInTheDocument();
    expect(screen.getAllByTestId("questionnaire-option")).toHaveLength(3);
  });

  it("completes in four answers when the recommendation is already clear", () => {
    const { onComplete } = renderQuestionnaire();

    answerAndContinue(/feminine energy/i);
    answerAndContinue(/gentle routines and self-trust/i);
    answerAndContinue(/warm and encouraging/i);
    fireEvent.click(screen.getByRole("button", { name: /keep me steady without shame/i }));

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.touchStart(continueButton);
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith([
      expect.objectContaining({ questionId: "mentor_energy", optionId: "feminine_presence" }),
      expect.objectContaining({ questionId: "focus_area", optionId: "gentle_routines" }),
      expect.objectContaining({ questionId: "guidance_tone", optionId: "warm_encouraging" }),
      expect.objectContaining({ questionId: "progress_style", optionId: "gentle_accountability" }),
    ]);
  });

  it("dedupes pointerdown and click on the final continue action", () => {
    const { onComplete } = renderQuestionnaire();

    answerAndContinue(/feminine energy/i);
    answerAndContinue(/gentle routines and self-trust/i);
    answerAndContinue(/warm and encouraging/i);
    fireEvent.click(screen.getByRole("button", { name: /keep me steady without shame/i }));

    const continueButton = screen.getByRole("button", { name: /continue/i });
    fireEvent.pointerDown(continueButton, { pointerType: "mouse" });
    fireEvent.click(continueButton);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
