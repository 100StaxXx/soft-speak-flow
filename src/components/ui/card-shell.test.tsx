import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, outerShellCardClassName } from "./card";
import { GlassCard } from "./glass-card";

const expectOuterShellClasses = (className: string) => {
  expect(className).toContain("bg-white/[0.03]");
  expect(className).toContain("backdrop-blur-none");
  expect(className).toContain("border-white/10");
  expect(className).toContain("shadow-none");
};

describe("outer shell card treatment", () => {
  it("can be applied to plain Card shells via the shared class token", () => {
    render(
      <Card data-testid="plain-shell" className={outerShellCardClassName}>
        Plain shell
      </Card>,
    );

    expectOuterShellClasses(screen.getByTestId("plain-shell").className);
  });

  it("exposes a dedicated GlassCard pageShell variant", () => {
    render(
      <GlassCard data-testid="glass-shell" variant="pageShell">
        Glass shell
      </GlassCard>,
    );

    expectOuterShellClasses(screen.getByTestId("glass-shell").className);
  });
});
