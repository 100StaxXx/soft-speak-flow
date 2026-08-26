import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitReflection: vi.fn(),
  toast: vi.fn(),
  drawerRootProps: [] as Array<Record<string, unknown>>,
  dailyGuideThread: null as Record<string, unknown> | null,
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

vi.mock("@/hooks/useDailyGuideThread", () => ({
  useDailyGuideThread: () => ({
    thread: mocks.dailyGuideThread,
    previousThread: null,
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
    mocks.dailyGuideThread = null;
  });

  it("keeps deeper prompts collapsed until requested", () => {
    render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText(/where did you notice grace or goodness today\?/i)).toBeInTheDocument();
    expect(screen.getByText(/what would you like to thank God for\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/what was difficult, or may need confession or repair\?/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/what is one small faithful step for tomorrow\?/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

    expect(screen.getByText(/what was difficult, or may need confession or repair\?/i)).toBeInTheDocument();
    expect(screen.getByText(/what is one small faithful step for tomorrow\?/i)).toBeInTheDocument();
  });

  it("returns to the focus chosen with the Guide earlier in the day", () => {
    mocks.dailyGuideThread = {
      focus_label: "A gentler pace",
      mentor_name: "Grace",
      practice_completed_at: null,
    };

    render(<EveningReflectionDrawer open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText("Returning to today’s thread")).toBeInTheDocument();
    expect(screen.getByText(/you chose/i)).toHaveTextContent("A gentler pace");
    expect(screen.getByText(/where did “A gentler pace” show up/i)).toBeInTheDocument();
    expect(screen.getByText(/practice remained unfinished/i)).toBeInTheDocument();
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
        "A kindness, provision, moment of beauty, or small good worth receiving…",
      ));

      fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

      fireEvent.focus(screen.getByPlaceholderText("Name what was hard without rushing past it. What might need care or repair?"));
      fireEvent.focus(screen.getByPlaceholderText(
        "A small act of love, boundary, responsibility, rest, or return…",
      ));
      fireEvent.focus(screen.getByPlaceholderText("A person, gift, mercy, or ordinary thing you received today…"));

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
        "A kindness, provision, moment of beauty, or small good worth receiving…",
      ));

      fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

      fireEvent.focus(screen.getByPlaceholderText("Name what was hard without rushing past it. What might need care or repair?"));
      fireEvent.focus(screen.getByPlaceholderText(
        "A small act of love, boundary, responsibility, rest, or return…",
      ));
      fireEvent.focus(screen.getByPlaceholderText("A person, gift, mercy, or ordinary thing you received today…"));

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
        "A kindness, provision, moment of beauty, or small good worth receiving…",
      ) as HTMLTextAreaElement;
      const gratitudeInput = screen.getByPlaceholderText(
        "A person, gift, mercy, or ordinary thing you received today…",
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
      "A kindness, provision, moment of beauty, or small good worth receiving…",
    );
    fireEvent.change(winsInput, { target: { value: longWins } });

    expect((winsInput as HTMLTextAreaElement).value).toHaveLength(800);
    expect(screen.getByText("800/800")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go a little deeper/i }));

    fireEvent.change(
      screen.getByPlaceholderText("Name what was hard without rushing past it. What might need care or repair?"),
      { target: { value: "I felt stretched thin by the afternoon." } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("A small act of love, boundary, responsibility, rest, or return…"),
      { target: { value: "Take a short walk before jumping back into messages." } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("A person, gift, mercy, or ordinary thing you received today…"),
      { target: { value: "My friends checking in on me." } },
    );

    fireEvent.click(screen.getByRole("button", { name: /great/i }));
    fireEvent.click(screen.getByRole("button", { name: /save reflection/i }));

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
