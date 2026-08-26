import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AICompanionCreator } from "./AICompanionCreator";

describe("AICompanionCreator", () => {
  it("uses a color dropdown and symbolic Christian companion choices", () => {
    const onComplete = vi.fn();

    render(
      <AICompanionCreator
        onComplete={onComplete}
        storyTone="epic_adventure"
      />,
    );

    const colorSelect = screen.getByLabelText("Favorite Color");
    const eggGrid = screen.getByRole("group", { name: "Visual Nature" }).querySelector(".grid");

    expect(colorSelect.tagName).toBe("SELECT");
    expect(screen.getByRole("group", { name: "Species" })).toBeInTheDocument();
    expect(eggGrid).not.toBeNull();
    expect(eggGrid!).toHaveClass("grid-cols-2");
    expect(screen.getByTestId("companion-form-lamb")).toHaveAttribute("src", expect.stringContaining("lamb"));
    expect(screen.getByRole("button", { name: "Select Lamb companion" })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Select Open Sky Egg" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select Evening Indigo Egg" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Select Dawn Gold Egg" })).toBeEnabled();
    expect(screen.queryByText("Awaiting")).not.toBeInTheDocument();
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
    expect(screen.queryByText("Choose")).not.toBeInTheDocument();
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();
    expect(screen.queryByText("Companion Preset")).not.toBeInTheDocument();
    expect(screen.queryByText("Egg Preview")).not.toBeInTheDocument();
    expect(
      screen.getByText("Optional. If you leave this blank, Graceward will suggest a name."),
    ).toBeInTheDocument();
    expect(screen.getByText("Leave blank for a suggested companion name.")).toBeInTheDocument();

    fireEvent.change(colorSelect, { target: { value: "#9b6bff" } });
    fireEvent.click(screen.getByRole("button", { name: "Select Living Green Egg" }));
    expect(screen.getByRole("button", { name: "Select Living Green Egg" })).toHaveAttribute("data-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Select Dove companion" }));
    fireEvent.click(screen.getByRole("button", { name: "Create My Companion" }));

    expect(onComplete).toHaveBeenCalledWith({
      favoriteColor: "#9b6bff",
      spiritAnimal: "Dove",
      coreElement: "nature",
      storyTone: "epic_adventure",
      companionName: null,
    });
  }, 10_000);
});
