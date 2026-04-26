import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AICompanionCreator } from "./AICompanionCreator";

describe("AICompanionCreator", () => {
  it("uses a color dropdown and compact silhouette rows for the onboarding species choices", () => {
    const onComplete = vi.fn();

    render(
      <AICompanionCreator
        onComplete={onComplete}
        storyTone="epic_adventure"
      />,
    );

    const colorSelect = screen.getByLabelText("Favorite Color");

    expect(colorSelect.tagName).toBe("SELECT");
    expect(screen.getByRole("group", { name: "Species" })).toBeInTheDocument();
    expect(screen.getByTestId("species-silhouette-dragon")).toHaveAttribute(
      "src",
      "/onboarding/locked-species-silhouettes/dragon.png",
    );
    expect(screen.getByTestId("species-silhouette-dragon")).toHaveAttribute(
      "data-silhouette-variant",
      "compact-black",
    );
    expect(screen.getByRole("button", { name: "Select Dragon species" })).toHaveAttribute("data-selected", "true");
    expect(screen.getAllByText(/Awaiting/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Awakening/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("Companion Preset")).not.toBeInTheDocument();
    expect(screen.queryByText("Egg Preview")).not.toBeInTheDocument();
    expect(
      screen.getByText("Optional. If you do not choose a companion name, one will be granted to your companion."),
    ).toBeInTheDocument();
    expect(screen.getByText("Leave blank for a granted companion name.")).toBeInTheDocument();

    fireEvent.change(colorSelect, { target: { value: "#9b6bff" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Owl species" }));
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
