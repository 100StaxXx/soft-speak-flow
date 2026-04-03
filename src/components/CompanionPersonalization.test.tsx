import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanionPersonalization } from "./CompanionPersonalization";

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

describe("CompanionPersonalization", () => {
  it("lets onboarding users choose an egg and story tone before beginning the journey", () => {
    const onComplete = vi.fn();

    render(
      <CompanionPersonalization
        onComplete={onComplete}
        mode="onboarding"
        layout="fullscreen"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /ice egg/i }));
    fireEvent.click(screen.getByRole("button", { name: /whimsical & playful/i }));
    fireEvent.click(screen.getByRole("button", { name: /begin your journey/i }));

    expect(onComplete).toHaveBeenCalledWith({
      coreElement: "ice",
      favoriteColor: "#60A5FA",
      presetId: null,
      spiritAnimal: "Egg",
      storyTone: "whimsical_playful",
    });
  }, 15000);

  it("keeps hatch mode selecting a creature form while preserving the egg element and story tone", () => {
    const onComplete = vi.fn();

    render(
      <CompanionPersonalization
        onComplete={onComplete}
        mode="hatch"
        layout="compact"
        initialElement="ice"
        initialStoryTone="dark_intense"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /kitsune/i }));
    fireEvent.click(screen.getByRole("button", { name: /hatch companion/i }));

    expect(onComplete).toHaveBeenCalledWith({
      coreElement: "ice",
      favoriteColor: "#60A5FA",
      presetId: "fox",
      spiritAnimal: "Kitsune",
      storyTone: "dark_intense",
    });
  }, 25000);
});
