import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryPrologue } from "./StoryPrologue";

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, ...props }: any) => React.createElement(tag, props, children);
      },
    },
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

vi.mock("@/components/LegalDocumentViewer", () => ({
  LegalDocumentViewer: () => null,
}));

describe("StoryPrologue", () => {
  it("requires a valid name, age confirmation, and legal acceptance before continuing", () => {
    const onComplete = vi.fn();

    render(<StoryPrologue onComplete={onComplete} />);

    const button = screen.getByRole("button", { name: /begin my journey/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), {
      target: { value: "N" },
    });
    fireEvent.click(screen.getByLabelText(/13 years of age or older/i));
    fireEvent.click(screen.getByLabelText(/terms of service, privacy policy/i));
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), {
      target: { value: "  Nova  " },
    });
    expect(screen.getByRole("button", { name: /begin my journey/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /begin my journey/i }));
    expect(onComplete).toHaveBeenCalledWith("Nova");
  });
});
