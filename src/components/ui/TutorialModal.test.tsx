import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Compass, Sparkles } from "lucide-react";
import { TutorialModal } from "./TutorialModal";

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

describe("TutorialModal", () => {
  it("renders as a non-blocking floating card when open", () => {
    render(
      <TutorialModal
        open
        onClose={vi.fn()}
        icon={Compass}
        title="Tutorial Title"
        subtitle="Tutorial Subtitle"
        features={[{ icon: Sparkles, text: "Feature text" }]}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Tutorial Title" })).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-floating-wrapper")).toHaveClass("pointer-events-none");
    expect(screen.getByText("Tutorial Subtitle")).toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("calls onClose from both CTA and Hide controls", () => {
    const onClose = vi.fn();

    render(
      <TutorialModal
        open
        onClose={onClose}
        icon={Compass}
        title="Tutorial Title"
        subtitle="Tutorial Subtitle"
        features={[{ icon: Sparkles, text: "Feature text" }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Hide tutorial" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not render when closed", () => {
    render(
      <TutorialModal
        open={false}
        onClose={vi.fn()}
        icon={Compass}
        title="Tutorial Title"
        subtitle="Tutorial Subtitle"
        features={[{ icon: Sparkles, text: "Feature text" }]}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
