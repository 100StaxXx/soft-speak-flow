import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => ({
    name: "The Icon",
  }),
}));

import { MentorQuickChat } from "./MentorQuickChat";

describe("MentorQuickChat", () => {
  it("uses a fully transparent outer shell while keeping the quick chat content visible", () => {
    render(<MentorQuickChat />);

    const shell = screen.getByTestId("mentor-quick-chat-shell");

    expect(shell).toHaveClass("bg-transparent");
    expect(shell).toHaveClass("backdrop-blur-none");
    expect(shell).toHaveClass("shadow-none");
    expect(screen.getByRole("heading", { name: "Ask The Icon" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Or type your own...")).toBeInTheDocument();
  });

  it("navigates with the typed custom question", () => {
    render(<MentorQuickChat />);

    fireEvent.change(screen.getByPlaceholderText("Or type your own..."), {
      target: { value: "How do I stay focused?" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Send question" }));

    expect(mocks.navigate).toHaveBeenCalledWith("/mentor-chat", {
      state: { initialMessage: "How do I stay focused?" },
    });
  });
});
