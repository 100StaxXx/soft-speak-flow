import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitReflection: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DrawerContent: ({
    children,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => <div {...props}>{children}</div>,
  DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) => (
    <h2 {...props}>{children}</h2>
  ),
  DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/hooks/useEveningReflection", () => ({
  useEveningReflection: () => ({
    submitReflection: mocks.submitReflection,
    isSubmitting: false,
  }),
}));

vi.mock("@/hooks/useIOSKeyboardAvoidance", () => ({
  useIOSKeyboardAvoidance: () => ({
    containerStyle: {},
    inputStyle: {},
    scrollInputIntoView: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}));

import { EveningReflectionDrawer } from "./EveningReflectionDrawer";

describe("EveningReflectionDrawer", () => {
  beforeEach(() => {
    mocks.submitReflection.mockReset();
    mocks.submitReflection.mockResolvedValue(undefined);
    mocks.toast.mockReset();
  });

  it("keeps deeper prompts collapsed until requested", () => {
    render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/what went well today\?/i)).toBeInTheDocument();
    expect(screen.getByText(/what are you grateful for\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/anything else you'd like to reflect on from today\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/what's one small adjustment you'd like to make tomorrow\?/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

    expect(screen.getByText(/anything else you'd like to reflect on from today\?/i)).toBeInTheDocument();
    expect(screen.getByText(/what's one small adjustment you'd like to make tomorrow\?/i)).toBeInTheDocument();
  });

  it("limits entries to 800 characters and submits all four sections", async () => {
    render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

    const longWins = "a".repeat(900);
    const winsInput = screen.getByPlaceholderText(
      "A small win, a moment of joy, something you appreciated about today...",
    );
    fireEvent.change(winsInput, { target: { value: longWins } });

    expect((winsInput as HTMLTextAreaElement).value).toHaveLength(800);
    expect(screen.getByText("800/800")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

    fireEvent.change(
      screen.getByPlaceholderText("Anything else that feels worth naming tonight..."),
      { target: { value: "I felt stretched thin by the afternoon." } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("One small shift, boundary, or choice you'd like to try tomorrow..."),
      { target: { value: "Take a short walk before jumping back into messages." } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Something or someone you appreciate today..."),
      { target: { value: "My friends checking in on me." } },
    );

    fireEvent.click(screen.getByRole("button", { name: /great/i }));
    fireEvent.click(screen.getByRole("button", { name: /complete reflection/i }));

    await waitFor(() => {
      expect(mocks.submitReflection).toHaveBeenCalledWith({
        mood: "great",
        wins: "a".repeat(800),
        additionalReflection: "I felt stretched thin by the afternoon.",
        tomorrowAdjustment: "Take a short walk before jumping back into messages.",
        gratitude: "My friends checking in on me.",
      });
    });
  });
});
