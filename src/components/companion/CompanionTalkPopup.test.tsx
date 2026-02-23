import { render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CompanionTalkPopup } from "./CompanionTalkPopup";

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

describe("CompanionTalkPopup", () => {
  it("renders companion byline when name exists", () => {
    render(
      <CompanionTalkPopup
        isVisible
        onDismiss={vi.fn()}
        message="Hello, friend."
        companionName="Nova"
        companionImageUrl={null}
      />,
    );

    expect(screen.getByText("— Nova")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Nova says: Hello, friend.");
  });

  it("hides byline and keeps accessible label meaningful when name is empty", () => {
    render(
      <CompanionTalkPopup
        isVisible
        onDismiss={vi.fn()}
        message="Hello, friend."
        companionName=""
        companionImageUrl={null}
      />,
    );

    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Companion says: Hello, friend.");
    expect(screen.getByText('"Hello, friend."')).toBeInTheDocument();
  });
});
