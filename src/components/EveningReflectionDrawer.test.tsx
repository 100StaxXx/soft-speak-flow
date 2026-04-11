import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitReflection: vi.fn(),
  toast: vi.fn(),
  drawerRootProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    children,
    ...props
  }: {
    open: boolean;
    children: ReactNode;
  } & Record<string, unknown>) => {
    mocks.drawerRootProps.push(props);
    return open ? <div>{children}</div> : null;
  },
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
    mocks.drawerRootProps.length = 0;
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

  it("does not call scrollIntoView when moving between textareas", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoViewMock = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });

    try {
      render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

      fireEvent.focus(screen.getByPlaceholderText(
        "A small win, a moment of joy, something you appreciated about today...",
      ));

      fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

      fireEvent.focus(screen.getByPlaceholderText("Anything else that feels worth naming tonight..."));
      fireEvent.focus(screen.getByPlaceholderText(
        "One small shift, boundary, or choice you'd like to try tomorrow...",
      ));
      fireEvent.focus(screen.getByPlaceholderText("Something or someone you appreciate today..."));

      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
          configurable: true,
          writable: true,
          value: originalScrollIntoView,
        });
      } else {
        delete (HTMLElement.prototype as HTMLElement & { scrollIntoView?: unknown }).scrollIntoView;
      }
    }
  });

  it("disables Vaul input repositioning for the reflection drawer", () => {
    render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

    expect(mocks.drawerRootProps).toHaveLength(1);
    expect(mocks.drawerRootProps[0]?.repositionInputs).toBe(false);
  });

  it("does not call window.scrollTo when focusing between textareas", async () => {
    const windowScrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    try {
      render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

      fireEvent.focus(screen.getByPlaceholderText(
        "A small win, a moment of joy, something you appreciated about today...",
      ));

      fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

      fireEvent.focus(screen.getByPlaceholderText("Anything else that feels worth naming tonight..."));
      fireEvent.focus(screen.getByPlaceholderText(
        "One small shift, boundary, or choice you'd like to try tomorrow...",
      ));
      fireEvent.focus(screen.getByPlaceholderText("Something or someone you appreciate today..."));

      await waitFor(() => {
        expect(windowScrollToSpy).not.toHaveBeenCalled();
      });
    } finally {
      windowScrollToSpy.mockRestore();
    }
  });

  it("keeps focus correction local to the drawer scroller only when a textarea is clipped", async () => {
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const elementScrollToSpy = vi.fn();
    const windowScrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: elementScrollToSpy,
    });

    try {
      const { container } = render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

      const scrollContainer = container.querySelector(
        "div.mx-auto[data-vaul-no-drag]",
      ) as HTMLDivElement | null;
      const winsInput = screen.getByPlaceholderText(
        "A small win, a moment of joy, something you appreciated about today...",
      ) as HTMLTextAreaElement;
      const gratitudeInput = screen.getByPlaceholderText(
        "Something or someone you appreciate today...",
      ) as HTMLTextAreaElement;

      expect(scrollContainer).not.toBeNull();

      Object.defineProperty(scrollContainer!, "scrollTop", {
        configurable: true,
        writable: true,
        value: 100,
      });

      Object.defineProperty(scrollContainer!, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          top: 100,
          bottom: 400,
          left: 0,
          right: 320,
          width: 320,
          height: 300,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }),
      });

      Object.defineProperty(winsInput, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          top: 120,
          bottom: 200,
          left: 0,
          right: 320,
          width: 320,
          height: 80,
          x: 0,
          y: 120,
          toJSON: () => ({}),
        }),
      });

      Object.defineProperty(gratitudeInput, "getBoundingClientRect", {
        configurable: true,
        value: () => ({
          top: 360,
          bottom: 460,
          left: 0,
          right: 320,
          width: 320,
          height: 100,
          x: 0,
          y: 360,
          toJSON: () => ({}),
        }),
      });

      fireEvent.focus(winsInput);

      await waitFor(() => {
        expect(elementScrollToSpy).not.toHaveBeenCalled();
      });

      fireEvent.focus(gratitudeInput);

      await waitFor(() => {
        expect(elementScrollToSpy).toHaveBeenCalledTimes(1);
      });

      expect(elementScrollToSpy).toHaveBeenLastCalledWith({ top: 176, behavior: "auto" });
      expect(windowScrollToSpy).not.toHaveBeenCalled();
    } finally {
      if (originalScrollTo) {
        Object.defineProperty(HTMLElement.prototype, "scrollTo", {
          configurable: true,
          writable: true,
          value: originalScrollTo,
        });
      } else {
        delete (HTMLElement.prototype as HTMLElement & { scrollTo?: unknown }).scrollTo;
      }
      windowScrollToSpy.mockRestore();
    }
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
