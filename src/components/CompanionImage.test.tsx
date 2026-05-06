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

  it("uses stored focal metadata for generated cover art without translating the image", () => {
    render(
      <CompanionImage
        src="https://example.com/generated-companion.png"
        alt="Generated Companion"
        fit="cover"
        focalX={0.375}
        focalY={0.625}
      />,
    );

    const image = screen.getByRole("img", { name: "Generated Companion" });
    expect(image).toHaveAttribute("data-companion-image-focal-source", "stored");
    expect(image).toHaveClass("object-cover");
    expect(image).toHaveStyle({ objectPosition: "37.5% 62.5%" });
    expect(image.style.transform).toBe("");
  });

  it("uses source aspect ratio for generated cover art when provided", () => {
    render(
      <CompanionImage
        src="https://example.com/generated-companion.png"
        alt="Generated Landscape Companion"
        fit="cover"
        focalX={0.32}
        focalY={0.68}
        sourceAspectRatio={1536 / 1024}
      />,
    );

    const image = screen.getByRole("img", { name: "Generated Landscape Companion" });
    expect(image).toHaveAttribute("data-companion-image-focal-source", "stored");
    expect(image).toHaveClass("object-cover");
    expect(image).toHaveStyle({ objectPosition: "0% 50%" });
  });
});
