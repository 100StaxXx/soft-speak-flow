import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoryQuestionnaire } from "./StoryQuestionnaire";

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
  };
});

describe("StoryQuestionnaire", () => {
  it("disables back and answer buttons while submitting", () => {
    const onComplete = vi.fn();
    render(
      <StoryQuestionnaire
        faction="starfall"
        onComplete={onComplete}
        isSubmitting={true}
      />,
    );

    const backButton = screen.getByRole("button", { name: /back/i });
    const firstOption = screen.getByRole("button", { name: /feminine presence/i });

    expect(backButton).toBeDisabled();
    expect(firstOption).toBeDisabled();

    fireEvent.click(firstOption);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("calls onComplete once on rapid double tap of the final answer", () => {
    const onComplete = vi.fn();
    render(<StoryQuestionnaire faction="stellar" onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: /feminine presence/i }));
    fireEvent.click(screen.getByRole("button", { name: /clarity & mindset/i }));
    fireEvent.click(screen.getByRole("button", { name: /gentle & compassionate/i }));

    const finalOption = screen.getByRole("button", { name: /clear principles and logic/i });
    fireEvent.click(finalOption);
    fireEvent.click(finalOption);

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ questionId: "mentor_energy", optionId: "feminine_presence" }),
        expect.objectContaining({ questionId: "focus_area", optionId: "clarity_mindset" }),
        expect.objectContaining({ questionId: "guidance_tone", optionId: "gentle_compassionate" }),
        expect.objectContaining({ questionId: "progress_style", optionId: "principles_logic" }),
      ]),
    );
  });
});

