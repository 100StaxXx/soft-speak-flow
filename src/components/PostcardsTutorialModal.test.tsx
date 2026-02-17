import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PostcardsTutorialModal } from "./PostcardsTutorialModal";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2 {...props}>{children}</h2>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p {...props}>{children}</p>
    ),
  },
}));

describe("PostcardsTutorialModal", () => {
  it("renders as a non-blocking floating card when open", () => {
    render(<PostcardsTutorialModal open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Your Companion's Journey" })).toBeInTheDocument();
    expect(screen.getByTestId("postcards-tutorial-floating-wrapper")).toHaveClass("pointer-events-none");
    expect(screen.getByText("Discover the magic of cosmic postcards")).toBeInTheDocument();
  });

  it("calls onClose from hide control and primary action", () => {
    const onClose = vi.fn();
    render(<PostcardsTutorialModal open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Hide tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: /Begin My Journey/i }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not render when closed", () => {
    render(<PostcardsTutorialModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
