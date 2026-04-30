import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToastProvider, ToastViewport } from "./toast";

describe("ToastViewport", () => {
  it("consumes completion feedback stack offsets", () => {
    render(
      <ToastProvider>
        <ToastViewport data-testid="toast-viewport" />
      </ToastProvider>,
    );

    const viewport = screen.getByTestId("toast-viewport");

    expect(viewport.className).toContain(
      "bottom-[calc(64px+env(safe-area-inset-bottom,0px)+12px+var(--completion-feedback-toast-stack-offset,0px))]",
    );
    expect(viewport.className).toContain(
      "sm:bottom-[var(--completion-feedback-toast-bottom-offset,0px)]",
    );
  });
});
