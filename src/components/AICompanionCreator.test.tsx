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
    const eggGrid = screen.getByRole("group", { name: "Egg Element" }).querySelector(".grid");

    expect(colorSelect.tagName).toBe("SELECT");
    expect(screen.getByRole("group", { name: "Species" })).toBeInTheDocument();
    expect(eggGrid).not.toBeNull();
    expect(eggGrid!).toHaveClass("grid-cols-2");
    expect(screen.getByTestId("species-silhouette-dragon")).toHaveAttribute(
      "src",
      "/onboarding/locked-species-silhouettes/dragon.png",
    );
    expect(screen.getByTestId("species-silhouette-dragon")).toHaveAttribute(
      "data-silhouette-variant",
      "compact-black",
    );
    expect(screen.getByRole("button", { name: "Select Dragon species" })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Select Storm Egg" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select Void Egg" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select Light Egg" })).toBeEnabled();
    expect(screen.queryByText("Awaiting")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose")).not.toBeInTheDocument();
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();
    expect(screen.queryByText("Companion Preset")).not.toBeInTheDocument();
    expect(screen.queryByText("Egg Preview")).not.toBeInTheDocument();
    expect(
      screen.getByText("Optional. If you do not choose a companion name, one will be granted to your companion."),
    ).toBeInTheDocument();
    expect(screen.getByText("Leave blank for a granted companion name.")).toBeInTheDocument();

    fireEvent.change(colorSelect, { target: { value: "#9b6bff" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Storm Egg" }));
    expect(screen.getByRole("button", { name: "Select Storm Egg" })).toHaveAttribute("data-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Select Light Egg" }));
    expect(screen.getByRole("button", { name: "Select Light Egg" })).toHaveAttribute("data-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Select Void Egg" }));
    fireEvent.click(screen.getByRole("button", { name: "Select Mechanical Dragon species" }));
    fireEvent.click(screen.getByRole("button", { name: "Create AI Egg" }));

    expect(onComplete).toHaveBeenCalledWith({
      favoriteColor: "#9b6bff",
      spiritAnimal: "Mechanical Dragon",
      coreElement: "void",
      storyTone: "epic_adventure",
      companionName: null,
    });
  });
});
