import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTutorialTarget, resolveTutorialTargetFromSelectors } from "./tutorialTargets";

const originalElementsFromPoint = document.elementsFromPoint;

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

const setRect = (element: Element, value: DOMRect) => {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(value);
};

describe("tutorial target resolution", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalElementsFromPoint) {
      Object.defineProperty(document, "elementsFromPoint", {
        configurable: true,
        value: originalElementsFromPoint,
      });
    } else {
      Reflect.deleteProperty(document, "elementsFromPoint");
    }
    document.body.innerHTML = "";
  });

  it("chooses a visible duplicate instead of the first hidden match", () => {
    document.body.innerHTML = `
      <button data-tour="tutorial-target" style="display:none">hidden</button>
      <button data-tour="tutorial-target">visible</button>
    `;
    const [hidden, visible] = Array.from(
      document.querySelectorAll('[data-tour="tutorial-target"]')
    );
    setRect(hidden, rect({ top: 40, left: 20, width: 180, height: 48 }));
    setRect(visible, rect({ top: 80, left: 24, width: 190, height: 52 }));

    const resolved = resolveTutorialTarget('[data-tour="tutorial-target"]');

    expect(resolved?.element).toBe(visible);
  });

  it("skips targets inside display none or hidden ancestors", () => {
    document.body.innerHTML = `
      <div style="display:none"><button data-tour="tutorial-target">display none</button></div>
      <div hidden><button data-tour="tutorial-target">hidden ancestor</button></div>
      <button data-tour="tutorial-target">visible</button>
    `;
    const targets = Array.from(
      document.querySelectorAll('[data-tour="tutorial-target"]')
    );
    targets.forEach((target, index) =>
      setRect(target, rect({ top: 60 + index * 64, left: 20, width: 180, height: 48 }))
    );

    const resolved = resolveTutorialTarget('[data-tour="tutorial-target"]');

    expect(resolved?.element.textContent).toBe("visible");
  });

  it("returns unavailable for zero-size targets", () => {
    document.body.innerHTML = `<button data-tour="tutorial-target">zero</button>`;
    const target = document.querySelector('[data-tour="tutorial-target"]')!;
    setRect(target, rect({ top: 80, left: 24, width: 0, height: 48 }));

    expect(resolveTutorialTarget('[data-tour="tutorial-target"]')).toBeNull();
  });

  it("returns unavailable when a non-tutorial overlay covers the target", () => {
    document.body.innerHTML = `
      <button data-tour="tutorial-target">covered</button>
      <div data-testid="foreign-portal-overlay"></div>
    `;
    const target = document.querySelector('[data-tour="tutorial-target"]')!;
    const overlay = document.querySelector('[data-testid="foreign-portal-overlay"]')!;
    setRect(target, rect({ top: 80, left: 24, width: 190, height: 52 }));
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => [overlay, target, document.body]),
    });

    expect(resolveTutorialTarget('[data-tour="tutorial-target"]')).toBeNull();
  });

  it("ignores declared tutorial layers covering the target", () => {
    document.body.innerHTML = `
      <button data-tour="tutorial-target">covered by tutorial</button>
      <div data-tutorial-layer="true"><div data-testid="tutorial-overlay-child"></div></div>
    `;
    const target = document.querySelector('[data-tour="tutorial-target"]')!;
    const overlayChild = document.querySelector('[data-testid="tutorial-overlay-child"]')!;
    setRect(target, rect({ top: 80, left: 24, width: 190, height: 52 }));
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => [overlayChild, target, document.body]),
    });

    expect(resolveTutorialTarget('[data-tour="tutorial-target"]')?.element).toBe(target);
  });

  it("keeps a target available when only one sampled point is covered", () => {
    document.body.innerHTML = `
      <button data-tour="tutorial-target">partially covered</button>
      <div data-testid="small-overlay"></div>
    `;
    const target = document.querySelector('[data-tour="tutorial-target"]')!;
    const overlay = document.querySelector('[data-testid="small-overlay"]')!;
    setRect(target, rect({ top: 80, left: 24, width: 190, height: 52 }));
    const elementsFromPoint = vi.fn()
      .mockReturnValueOnce([overlay, target, document.body])
      .mockReturnValue([target, document.body]);
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: elementsFromPoint,
    });

    const resolved = resolveTutorialTarget('[data-tour="tutorial-target"]');

    expect(resolved?.element).toBe(target);
    expect(elementsFromPoint).toHaveBeenCalledTimes(2);
  });

  it("samples from the true center before falling back to visible portions of a partially offscreen target", () => {
    document.body.innerHTML = `<button data-tour="tutorial-target">partially visible</button>`;
    const target = document.querySelector('[data-tour="tutorial-target"]')!;
    setRect(target, rect({ top: -80, left: 24, width: 190, height: 100 }));
    const sampledY: number[] = [];
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn((_x: number, y: number) => {
        sampledY.push(y);
        return [target, document.body];
      }),
    });

    expect(resolveTutorialTarget('[data-tour="tutorial-target"]')?.element).toBe(target);
    expect(sampledY.length).toBeGreaterThan(0);
    expect(sampledY[0]).toBe(0);
    expect(sampledY.every((y) => y >= 0 && y <= 20)).toBe(true);
  });

  it("returns the first selector with an available target", () => {
    document.body.innerHTML = `
      <button data-tour="missing-visible" style="display:none">hidden</button>
      <button data-tour="tutorial-target">visible</button>
    `;
    const hidden = document.querySelector('[data-tour="missing-visible"]')!;
    const visible = document.querySelector('[data-tour="tutorial-target"]')!;
    setRect(hidden, rect({ top: 20, left: 20, width: 120, height: 44 }));
    setRect(visible, rect({ top: 80, left: 24, width: 190, height: 52 }));

    const resolved = resolveTutorialTargetFromSelectors([
      '[data-tour="missing-visible"]',
      '[data-tour="tutorial-target"]',
    ]);

    expect(resolved?.selector).toBe('[data-tour="tutorial-target"]');
    expect(resolved?.element).toBe(visible);
  });
});
