import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AICompanionCreator } from "./AICompanionCreator";

describe("AICompanionCreator", () => {
  it("uses dropdowns for the onboarding color and species choices", () => {
    const onComplete = vi.fn();

    render(
      <AICompanionCreator
        onComplete={onComplete}
        storyTone="epic_adventure"
      />,
    );

    const colorSelect = screen.getByLabelText("Favorite Color");
    const speciesSelect = screen.getByLabelText("Species");

    expect(colorSelect.tagName).toBe("SELECT");
    expect(speciesSelect.tagName).toBe("SELECT");

    fireEvent.change(colorSelect, { target: { value: "#9b6bff" } });
    fireEvent.change(speciesSelect, { target: { value: "Owl" } });
    fireEvent.click(screen.getByRole("button", { name: "Create AI Egg" }));

    expect(onComplete).toHaveBeenCalledWith({
      favoriteColor: "#9b6bff",
      spiritAnimal: "Owl",
      coreElement: "void",
      storyTone: "epic_adventure",
      companionName: null,
    });
  });
});
