import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompanionBadge } from "./CompanionBadge";

describe("CompanionBadge", () => {
  it("shows the visual stage display instead of the progression level", () => {
    render(<CompanionBadge element="storm" stage={4} />);

    expect(screen.getByText("Storm")).toBeInTheDocument();
    expect(screen.getByText("Form 1 • Hatchling")).toBeInTheDocument();
    expect(screen.queryByText("Form 4 • Hatchling")).not.toBeInTheDocument();
  });

  it("caps the final form at visual stage 7", () => {
    render(<CompanionBadge element="light" stage={100} />);

    expect(screen.getByText("Form 7 • Ascended")).toBeInTheDocument();
  });
});
