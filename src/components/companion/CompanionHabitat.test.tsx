import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { COMPANION_HABITATS, CompanionHabitat } from "./CompanionHabitat";

describe("CompanionHabitat", () => {
  it.each(Object.entries(COMPANION_HABITATS))("matches %s at hatch and later evolutions", (element, src) => {
    const { rerender } = render(<CompanionHabitat element={element} stage={1} />);
    expect(screen.getByTestId("companion-habitat").querySelector("img")).toHaveAttribute("src", src);
    rerender(<CompanionHabitat element={element} stage={21} />);
    expect(screen.getByTestId("companion-habitat").querySelector("img")).toHaveAttribute("src", `/companion-habitats/${element}-guardian.webp`);
    expect(screen.getByTestId("companion-habitat")).toHaveAttribute("aria-hidden", "true");
  });

  it.each([[1,"hatchling"],[4,"hatchling"],[5,"initiate"],[12,"initiate"],[13,"awakened"],[20,"awakened"],[21,"guardian"],[35,"guardian"],[36,"champion"],[55,"champion"],[56,"mythic"],[80,"mythic"],[81,"ascended"],[100,"ascended"]])("uses the claimed form at level %s", (stage, tier) => {
    render(<CompanionHabitat element="storm" stage={Number(stage)} />);
    expect(screen.getByTestId("companion-habitat")).toHaveAttribute("data-tier", tier);
  });

  it("preserves egg scenes and handles unknown elements without broken requests", () => {
    const { rerender } = render(<CompanionHabitat element="storm" stage={0} />);
    expect(screen.queryByTestId("companion-habitat")).not.toBeInTheDocument();
    rerender(<CompanionHabitat element="unknown" stage={1} />);
    expect(screen.queryByTestId("companion-habitat")).not.toBeInTheDocument();
    rerender(<CompanionHabitat element=" STORM " stage={1} />);
    expect(screen.getByTestId("companion-habitat")).toHaveAttribute("data-element", "storm");
  });
});
