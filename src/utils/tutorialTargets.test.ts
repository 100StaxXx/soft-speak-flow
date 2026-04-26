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
      <button data-tour="campaign-builder-launcher" style="display:none">hidden</button>
      <button data-tour="campaign-builder-launcher">visible</button>
    `;
    const [hidden, visible] = Array.from(
      document.querySelectorAll('[data-tour="campaign-builder-launcher"]')
    );
    setRect(hidden, rect({ top: 40, left: 20, width: 180, height: 48 }));
    setRect(visible, rect({ top: 80, left: 24, width: 190, height: 52 }));

    const resolved = resolveTutorialTarget('[data-tour="campaign-builder-launcher"]');

    expect(resolved?.element).toBe(visible);
  });

  it("skips targets inside display none or hidden ancestors", () => {
    document.body.innerHTML = `
      <div style="display:none"><button data-tour="campaign-builder-launcher">display none</button></div>
      <div hidden><button data-tour="campaign-builder-launcher">hidden ancestor</button></div>
      <button data-tour="campaign-builder-launcher">visible</button>
    `;
    const targets = Array.from(
      document.querySelectorAll('[data-tour="campaign-builder-launcher"]')
    );
    targets.forEach((target, index) =>
      setRect(target, rect({ top: 60 + index * 64, left: 20, width: 180, height: 48 }))
    );

    const resolved = resolveTutorialTarget('[data-tour="campaign-builder-launcher"]');

    expect(resolved?.element.textContent).toBe("visible");
  });

  it("returns unavailable for zero-size targets", () => {
    document.body.innerHTML = `<button data-tour="campaign-builder-launcher">zero</button>`;
    const target = document.querySelector('[data-tour="campaign-builder-launcher"]')!;
    setRect(target, rect({ top: 80, left: 24, width: 0, height: 48 }));

    expect(resolveTutorialTarget('[data-tour="campaign-builder-launcher"]')).toBeNull();
  });

  it("returns unavailable when a non-tutorial overlay covers the target", () => {
    document.body.innerHTML = `
      <button data-tour="campaign-builder-launcher">covered</button>
      <div data-testid="foreign-portal-overlay"></div>
    `;
    const target = document.querySelector('[data-tour="campaign-builder-launcher"]')!;
    const overlay = document.querySelector('[data-testid="foreign-portal-overlay"]')!;
    setRect(target, rect({ top: 80, left: 24, width: 190, height: 52 }));
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: vi.fn(() => [overlay, target, document.body]),
    });

    expect(resolveTutorialTarget('[data-tour="campaign-builder-launcher"]')).toBeNull();
  });

  it("returns the first selector with an available target", () => {
    document.body.innerHTML = `
      <button data-tour="missing-visible" style="display:none">hidden</button>
      <button data-tour="campaign-builder-launcher">visible</button>
    `;
    const hidden = document.querySelector('[data-tour="missing-visible"]')!;
    const visible = document.querySelector('[data-tour="campaign-builder-launcher"]')!;
    setRect(hidden, rect({ top: 20, left: 20, width: 120, height: 44 }));
    setRect(visible, rect({ top: 80, left: 24, width: 190, height: 52 }));

    const resolved = resolveTutorialTargetFromSelectors([
      '[data-tour="missing-visible"]',
      '[data-tour="campaign-builder-launcher"]',
    ]);

    expect(resolved?.selector).toBe('[data-tour="campaign-builder-launcher"]');
    expect(resolved?.element).toBe(visible);
  });
});
