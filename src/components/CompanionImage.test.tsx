import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompanionImage } from "./CompanionImage";

describe("CompanionImage", () => {
  it("renders bundled companion art with focal-aware cover positioning", () => {
    render(
      <CompanionImage
        src="/companion-eggs/egg__t0_egg__normal__storm.png"
        alt="Storm Egg"
        fit="cover"
      />,
    );

    const image = screen.getByRole("img", { name: "Storm Egg" });
    expect(image).toHaveAttribute("data-companion-image-focal-source", "manifest");
    expect(image).toHaveAttribute("data-companion-image-fit", "cover");
    expect(image).toHaveStyle({ objectPosition: "50% 33.62588070175439%" });
  });

  it("renders preset portraits in portrait mode with contain framing", () => {
    render(
      <CompanionImage
        src="/companion-presets/buttercat/t1_youth/normal/buttercat__t1_youth__normal__fire.png"
        alt="Buttercat Portrait"
        fit="portrait"
        element="fire"
      />,
    );

    const image = screen.getByRole("img", { name: "Buttercat Portrait" });
    expect(image).toHaveAttribute("data-companion-image-fit", "portrait");
    expect(image).toHaveAttribute("data-companion-image-focal-source", "manifest");
    expect(image).toHaveClass("object-contain");
    expect(image).toHaveStyle({ transform: "translate(0.000%, 2.930%)" });
  });
});
