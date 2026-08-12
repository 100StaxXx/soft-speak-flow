import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getCompanionInteractionPrompt } from "@/config/companionBehaviors";
import { CompanionInteractionBubble } from "./CompanionInteractionBubble";

describe("CompanionInteractionBubble", () => {
  it("renders accessible answer chips and returns the selected key", () => {
    const onAnswer = vi.fn();
    const prompt = getCompanionInteractionPrompt(21);

    render(
      <CompanionInteractionBubble
        companionName="Nova"
        message={prompt.question}
        prompt={prompt}
        prefersReducedMotion={false}
        onAnswer={onAnswer}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId("companion-interaction-bubble")).toHaveTextContent("Nova");
    fireEvent.click(screen.getByRole("button", { name: "Rest" }));
    expect(onAnswer).toHaveBeenCalledWith("rest");
  });

  it("can dismiss a transient reaction", () => {
    const onDismiss = vi.fn();
    render(
      <CompanionInteractionBubble
        companionName="Nova"
        message="I am right here."
        prompt={null}
        prefersReducedMotion
        onAnswer={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /dismiss companion message/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
