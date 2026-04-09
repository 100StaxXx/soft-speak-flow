import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card, outerShellCardClassName } from "./card";
import { GlassCard } from "./glass-card";

const expectOuterShellClasses = (className: string) => {
  expect(className).toContain("bg-card/[0.05]");
  expect(className).toContain("backdrop-blur-md");
  expect(className).toContain("border-border/25");
  expect(className).toContain("shadow-[0_10px_24px_rgba(0,0,0,0.14)]");
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
