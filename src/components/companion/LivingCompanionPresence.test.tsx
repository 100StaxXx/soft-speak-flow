import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  LivingCompanionCreatureMotion,
  LivingCompanionInteractionAura,
  LivingCompanionPresenceBubble,
  LivingCompanionWorldPulse,
} from "@/components/companion/LivingCompanionPresence";
import {
  getCompanionLifeStageProfile,
  getCompanionSpeciesMotionProfile,
} from "@/config/companionLife";

describe("LivingCompanionPresence", () => {
  it("renders a Companion response bubble and dismisses it", () => {
    const onDismiss = vi.fn();

    render(
      <LivingCompanionPresenceBubble
        prompt={{
          id: "path-chosen",
          kind: "comment",
          message: "The Path of Courage is open. I’ll meet you at the next marker.",
        }}
        companionName="Nova"
        prefersReducedMotion
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByTestId("living-companion-prompt")).toHaveAttribute("data-prompt-kind", "comment");

    fireEvent.click(screen.getByRole("button", { name: /dismiss companion message/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders no bubble without a prompt", () => {
    render(
      <LivingCompanionPresenceBubble
        prompt={null}
        companionName="Nova"
        prefersReducedMotion
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("living-companion-prompt")).not.toBeInTheDocument();
  });

  it("exposes body-language state and omits touch particles for reduced motion", () => {
    const { rerender } = render(
      <LivingCompanionInteractionAura
        bodyLanguage="concerned"
        interactionNonce={1}
        prefersReducedMotion
      />,
    );

    const aura = screen.getByTestId("living-companion-interaction-aura");
    expect(aura).toHaveAttribute("data-body-language", "concerned");
    expect(aura.querySelector(".living-companion-touch-ring")).toBeNull();

    rerender(
      <LivingCompanionInteractionAura
        bodyLanguage="happy"
        interactionNonce={2}
        prefersReducedMotion={false}
      />,
    );
    expect(aura).toHaveAttribute("data-body-language", "happy");
    expect(aura.querySelector(".living-companion-touch-ring")).not.toBeNull();
    expect(aura.querySelectorAll(".living-companion-touch-spark")).toHaveLength(4);
  });

  it("exposes stage, species, action, and story state for the living portrait", () => {
    const lifeStage = getCompanionLifeStageProfile(36);
    const speciesMotion = getCompanionSpeciesMotionProfile("phoenix");
    render(
      <>
        <LivingCompanionCreatureMotion
          activeAction="signature"
          gaze={{ x: 0.5, y: -0.25, active: true }}
          lifeStage={lifeStage}
          speciesMotion={speciesMotion}
          prefersReducedMotion
        >
          <img alt="Phoenix" />
        </LivingCompanionCreatureMotion>
        <LivingCompanionWorldPulse
          lifeStage={lifeStage}
          speciesMotion={speciesMotion}
          stateLabel="Sharing your momentum"
          activeActionLabel="Feather flare"
        />
      </>,
    );

    expect(screen.getByTestId("living-companion-creature-motion")).toHaveAttribute("data-life-action", "signature");
    expect(screen.getByTestId("living-companion-creature-motion")).toHaveAttribute("data-species", "phoenix");
    expect(screen.getByTestId("companion-world-pulse")).toHaveTextContent("The Widening Light");
    expect(screen.getByTestId("companion-world-pulse")).toHaveTextContent("fans its wings");
  });
});
