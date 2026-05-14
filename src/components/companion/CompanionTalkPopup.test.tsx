import { act, render, screen, waitFor } from "@testing-library/react";
import type { HTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanionTalkPopup } from "./CompanionTalkPopup";

const STACK_OFFSET_VAR = "--completion-feedback-toast-stack-offset";
const BOTTOM_OFFSET_VAR = "--completion-feedback-toast-bottom-offset";

vi.mock("framer-motion", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    AnimatePresence: ({
      children,
      onExitComplete,
    }: {
      children: ReactNode;
      onExitComplete?: () => void;
    }) => {
      React.useEffect(() => {
        if (!children) {
          onExitComplete?.();
        }
      }, [children, onExitComplete]);

      return children;
    },
    motion: {
      div: React.forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )),
    },
  };
});

const mockPopupHeight = (height: number | (() => number)) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => {
    const resolvedHeight = typeof height === "function" ? height() : height;

    return {
      bottom: resolvedHeight,
      height: resolvedHeight,
      left: 0,
      right: 320,
      top: 0,
      width: 320,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });

describe("CompanionTalkPopup", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(STACK_OFFSET_VAR);
    document.documentElement.style.removeProperty(BOTTOM_OFFSET_VAR);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

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

    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Nova says: Hello, friend.");
  });

  it("centers generated scene companion art in the popup avatar", () => {
    render(
      <CompanionTalkPopup
        isVisible
        onDismiss={vi.fn()}
        message="Hello, friend."
        companionName="Nova"
        companionImageUrl="https://assets.example.com/generated-companion.png"
      />,
    );

    expect(screen.getByRole("img", { name: "Nova" })).toHaveAttribute(
      "data-companion-image-fit",
      "contain",
    );
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

  it("stacks optional mentor feedback under the companion message", () => {
    render(
      <CompanionTalkPopup
        isVisible
        onDismiss={vi.fn()}
        message="Portfolio session is done. Launch moved closer."
        tone="locked_in"
        mentor={{
          personality: "Disciplined",
          message: "That is the standard. Keep it there.",
        }}
        companionName="Nova"
        companionImageUrl={null}
      />,
    );

    expect(screen.getByText('"Portfolio session is done. Launch moved closer."')).toBeInTheDocument();
    expect(screen.getByText("Disciplined")).toBeInTheDocument();
    expect(screen.getByText('"That is the standard. Keep it there."')).toBeInTheDocument();
    expect(screen.getByText("Disciplined").closest("div")?.parentElement).toHaveClass("border-t");
  });

  it("publishes toast stacking offsets while visible", async () => {
    mockPopupHeight(120);

    render(
      <CompanionTalkPopup
        isVisible
        onDismiss={vi.fn()}
        message="Quest complete."
        companionName="Nova"
        companionImageUrl={null}
      />,
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("132px");
    });
    expect(document.documentElement.style.getPropertyValue(BOTTOM_OFFSET_VAR)).toBe(
      "calc(64px + env(safe-area-inset-bottom, 0px) + 12px + 132px)",
    );
  });

  it("updates toast stacking offsets after ResizeObserver reports a size change", async () => {
    let popupHeight = 80;
    let resizeCallback: ResizeObserverCallback | null = null;
    const observeMock = vi.fn();
    const disconnectMock = vi.fn();

    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = observeMock;
      disconnect = disconnectMock;
      unobserve = vi.fn();
    }

    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    mockPopupHeight(() => popupHeight);

    render(
      <CompanionTalkPopup
        isVisible
        onDismiss={vi.fn()}
        message="Quest complete."
        companionName="Nova"
        companionImageUrl={null}
      />,
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("92px");
    });
    expect(observeMock).toHaveBeenCalled();

    popupHeight = 140;

    act(() => {
      resizeCallback?.([], {} as ResizeObserver);
    });

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("152px");
    });
  });

  it("clears toast stacking offsets when hidden or unmounted", async () => {
    mockPopupHeight(96);

    const props = {
      onDismiss: vi.fn(),
      message: "Quest complete.",
      companionName: "Nova",
      companionImageUrl: null,
    };
    const { rerender, unmount } = render(
      <CompanionTalkPopup
        {...props}
        isVisible
      />,
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("108px");
    });

    rerender(
      <CompanionTalkPopup
        {...props}
        isVisible={false}
      />,
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("");
      expect(document.documentElement.style.getPropertyValue(BOTTOM_OFFSET_VAR)).toBe("");
    });

    rerender(
      <CompanionTalkPopup
        {...props}
        isVisible
      />,
    );

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("108px");
    });

    unmount();

    expect(document.documentElement.style.getPropertyValue(STACK_OFFSET_VAR)).toBe("");
    expect(document.documentElement.style.getPropertyValue(BOTTOM_OFFSET_VAR)).toBe("");
  });
});
