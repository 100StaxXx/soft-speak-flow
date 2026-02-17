import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEffect, useState } from "react";
import { TutorialInteractionGuard } from "./TutorialInteractionGuard";

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const setElementRect = (
  element: HTMLElement,
  rect: Partial<DOMRectReadOnly>
) => {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: rect.left ?? 0,
      y: rect.top ?? 0,
      top: rect.top ?? 0,
      left: rect.left ?? 0,
      right: rect.right ?? 0,
      bottom: rect.bottom ?? 0,
      width: rect.width ?? 0,
      height: rect.height ?? 0,
      toJSON: () => ({}),
    }),
  });
};

describe("TutorialInteractionGuard", () => {
  it("blocks interactions outside target/panel while allowing target interaction", async () => {
    const onBlockedInteraction = vi.fn();
    const onTargetClick = vi.fn();

    function Harness() {
      const [target, setTarget] = useState<HTMLElement | null>(null);
      const [panel, setPanel] = useState<HTMLElement | null>(null);

      useEffect(() => {
        if (!target) return;
        setElementRect(target, {
          top: 140,
          left: 140,
          right: 220,
          bottom: 180,
          width: 80,
          height: 40,
        });
      }, [target]);

      return (
        <>
          <button ref={setTarget} data-testid="target" onClick={onTargetClick}>
            Target
          </button>
          <div ref={setPanel} data-testid="panel">
            <button>Panel Action</button>
          </div>
          <TutorialInteractionGuard
            active
            targetElement={target}
            panelElement={panel}
            onBlockedInteraction={onBlockedInteraction}
          />
        </>
      );
    }

    render(<Harness />);

    fireEvent.pointerDown(screen.getByTestId("tutorial-guard-mask-top"));
    expect(onBlockedInteraction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("target"));
    expect(onTargetClick).toHaveBeenCalledTimes(1);
  });

  it("recomputes spotlight geometry on resize", async () => {
    let top = 80;

    function Harness() {
      const [target, setTarget] = useState<HTMLElement | null>(null);

      useEffect(() => {
        if (!target) return;

        setElementRect(target, {
          top,
          left: 100,
          right: 160,
          bottom: top + 40,
          width: 60,
          height: 40,
        });
      }, [target]);

      return (
        <>
          <button ref={setTarget}>Target</button>
          <TutorialInteractionGuard active targetElement={target} panelElement={null} spotlightPadding={10} />
        </>
      );
    }

    render(<Harness />);

    await screen.findByTestId("tutorial-guard-ring");
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("tutorial-guard-ring")).toHaveStyle({ top: "70px" });
    });

    top = 220;
    const target = screen.getByRole("button", { name: "Target" });
    setElementRect(target, {
      top,
      left: 100,
      right: 160,
      bottom: top + 40,
      width: 60,
      height: 40,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("tutorial-guard-ring")).toHaveStyle({ top: "210px" });
    });
  });

  it("does not render when target is missing", () => {
    render(<TutorialInteractionGuard active targetElement={null} panelElement={null} />);
    expect(screen.queryByTestId("tutorial-interaction-guard")).not.toBeInTheDocument();
  });
});
