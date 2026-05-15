import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MentorSpotlightGuard } from "./MentorSpotlightGuard";

const rect = ({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}) =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const setRect = (element: Element, value = rect({ top: 20, left: 20, width: 40, height: 40 })) => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(value);
};

describe("MentorSpotlightGuard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("renders mask + ring when active target exists", () => {
    document.body.innerHTML = `
      <button data-tour="add-quest-fab" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">+</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    setRect(document.querySelector('[data-tour="add-quest-fab"]')!);

    render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="add-quest-fab"]'
      />
    );

    expect(screen.getByTestId("mentor-spotlight-guard")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Tutorial highlight active");
  });

  it("focuses the highlighted action and restores previous focus on cleanup", async () => {
    document.body.innerHTML = `
      <button data-testid="previous-focus">before</button>
      <button data-tour="add-quest-fab" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">+</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    const previousFocus = screen.getByTestId("previous-focus");
    const target = document.querySelector('[data-tour="add-quest-fab"]') as HTMLElement;
    setRect(target);
    previousFocus.focus();

    const { unmount } = render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="add-quest-fab"]'
      />
    );

    await waitFor(() => {
      expect(target).toHaveFocus();
    });

    unmount();
    expect(previousFocus).toHaveFocus();
  });

  it("moves focus to a new target without restoring previous focus mid-session", async () => {
    document.body.innerHTML = `
      <button data-testid="previous-focus">before</button>
      <button data-tour="first-action" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">first</button>
      <button data-tour="second-action" style="position:fixed;left:80px;top:20px;width:40px;height:40px;">second</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    const previousFocus = screen.getByTestId("previous-focus");
    const firstTarget = document.querySelector('[data-tour="first-action"]') as HTMLElement;
    const secondTarget = document.querySelector('[data-tour="second-action"]') as HTMLElement;
    setRect(firstTarget);
    setRect(secondTarget, rect({ top: 20, left: 80, width: 40, height: 40 }));
    previousFocus.focus();

    const { rerender, unmount } = render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="first-action"]'
      />
    );

    await waitFor(() => {
      expect(firstTarget).toHaveFocus();
    });

    rerender(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="second-action"]'
      />
    );

    await waitFor(() => {
      expect(secondTarget).toHaveFocus();
    });
    expect(previousFocus).not.toHaveFocus();

    unmount();
    expect(previousFocus).toHaveFocus();
  });

  it("blocks pointer interactions on blockers around the spotlight", () => {
    document.body.innerHTML = `
      <button data-tour="add-quest-fab" style="position:fixed;left:20px;top:20px;width:40px;height:40px;">+</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    setRect(document.querySelector('[data-tour="add-quest-fab"]')!);

    render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="add-quest-fab"]'
      />
    );

    const guard = screen.getByTestId("mentor-spotlight-guard");
    const blocker = guard.querySelector(".mentor-spotlight-blocker") as HTMLElement;
    expect(blocker).toBeInTheDocument();
    const clickSpy = vi.fn();
    document.body.addEventListener("click", clickSpy);
    fireEvent.click(blocker);
    expect(clickSpy).not.toHaveBeenCalled();
    document.body.removeEventListener("click", clickSpy);
  });

  it("derives the spotlight path from the target's computed corner radii", () => {
    document.body.innerHTML = `
      <button
        data-tour="rounded-target"
        style="position:fixed;left:20px;top:20px;width:120px;height:64px;border-top-left-radius:16px;border-top-right-radius:8px;border-bottom-right-radius:20px;border-bottom-left-radius:4px;"
      >rounded</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    setRect(
      document.querySelector('[data-tour="rounded-target"]')!,
      rect({ top: 20, left: 20, width: 120, height: 64 })
    );

    render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="rounded-target"]'
      />
    );

    const guard = screen.getByTestId("mentor-spotlight-guard");
    const path = guard.querySelector(".mentor-spotlight-ring") as SVGPathElement;
    expect(path.getAttribute("d")).toContain("A 16 16");
    expect(path.getAttribute("d")).toContain("A 8 8");
    expect(path.getAttribute("d")).toContain("A 20 20");
    expect(path.getAttribute("d")).toContain("A 4 4");
  });

  it("draws square, pill, and circle targets with matching SVG geometry", () => {
    document.body.innerHTML = `
      <button data-tour="square-target" style="position:fixed;left:20px;top:20px;width:80px;height:40px;">square</button>
      <button data-tour="pill-target" data-tour-shape="pill" style="position:fixed;left:20px;top:80px;width:120px;height:40px;">pill</button>
      <button data-tour="circle-target" data-tour-shape="circle" style="position:fixed;left:20px;top:140px;width:40px;height:40px;">circle</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    const square = document.querySelector('[data-tour="square-target"]') as HTMLElement;
    const pill = document.querySelector('[data-tour="pill-target"]') as HTMLElement;
    const circle = document.querySelector('[data-tour="circle-target"]') as HTMLElement;
    setRect(square, rect({ top: 20, left: 20, width: 80, height: 40 }));
    setRect(pill, rect({ top: 80, left: 20, width: 120, height: 40 }));
    setRect(circle, rect({ top: 140, left: 20, width: 40, height: 40 }));

    const { rerender } = render(
      <MentorSpotlightGuard active targetSelector='[data-tour="square-target"]' />
    );
    let path = screen.getByTestId("mentor-spotlight-path") as SVGPathElement;
    expect(path.getAttribute("d")).toBe("M 20 20 H 100 L 100 20 V 60 L 100 60 H 20 L 20 60 V 20 L 20 20 Z");

    rerender(<MentorSpotlightGuard active targetSelector='[data-tour="pill-target"]' />);
    path = screen.getByTestId("mentor-spotlight-path") as SVGPathElement;
    expect(path.getAttribute("d")).toContain("A 60 20");

    rerender(<MentorSpotlightGuard active targetSelector='[data-tour="circle-target"]' />);
    path = screen.getByTestId("mentor-spotlight-path") as SVGPathElement;
    expect(path.getAttribute("d")).toContain("A 20 20");
  });

  it("renders a non-blocking outline without masks", () => {
    document.body.innerHTML = `
      <section data-tour="morning-checkin" style="position:fixed;left:20px;top:20px;width:280px;height:180px;">check-in</section>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;

    const target = document.querySelector('[data-tour="morning-checkin"]') as HTMLElement;
    setRect(target, rect({ top: 20, left: 20, width: 280, height: 180 }));
    const clickSpy = vi.fn();
    target.addEventListener("click", clickSpy);

    render(
      <MentorSpotlightGuard
        active
        mode="outline"
        targetSelector='[data-tour="morning-checkin"]'
      />
    );

    const guard = screen.getByTestId("mentor-spotlight-guard");
    expect(guard).toHaveAttribute("data-mode", "outline");
    expect(guard.querySelector(".mentor-spotlight-mask")).toBeNull();
    expect(guard.querySelector(".mentor-spotlight-ring--outline")).toBeInTheDocument();

    fireEvent.click(target);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    target.removeEventListener("click", clickSpy);
  });

  it("highlights the visible duplicate when an inactive copy appears first", () => {
    document.body.innerHTML = `
      <button data-tour="companion-launcher-option-goal" style="display:none">hidden</button>
      <button data-tour="companion-launcher-option-goal">visible</button>
      <section data-tutorial="mentor-dialogue-panel"><button>panel</button></section>
    `;
    const [hiddenTarget, visibleTarget] = Array.from(
      document.querySelectorAll('[data-tour="companion-launcher-option-goal"]')
    );
    setRect(hiddenTarget, rect({ top: 300, left: 40, width: 200, height: 64 }));
    setRect(visibleTarget, rect({ top: 20, left: 20, width: 40, height: 40 }));

    render(
      <MentorSpotlightGuard
        active
        targetSelector='[data-tour="companion-launcher-option-goal"]'
      />
    );

    const ring = screen.getByTestId("mentor-spotlight-path");
    expect(ring.getAttribute("d")).toContain("M 20 20");
    expect(ring.getAttribute("d")).toContain("H 60");
  });
});
