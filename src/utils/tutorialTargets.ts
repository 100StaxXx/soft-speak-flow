export interface TutorialTargetResolution {
  selector: string;
  element: HTMLElement;
  rect: DOMRect;
}

const TUTORIAL_LAYER_SELECTOR = [
  '[data-testid="mentor-spotlight-guard"]',
  '[data-tutorial="mentor-dialogue-panel"]',
  ".mentor-spotlight-root",
  ".mentor-spotlight-mask",
  ".mentor-spotlight-ring",
].join(",");

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const isHTMLElement = (element: Element): element is HTMLElement =>
  element instanceof HTMLElement;

const hasHiddenAncestor = (element: HTMLElement): boolean => {
  let current: HTMLElement | null = element;

  while (current) {
    if (current.hidden || current.hasAttribute("hidden") || current.hasAttribute("inert")) {
      return true;
    }

    if (current.getAttribute("aria-hidden") === "true") {
      return true;
    }

    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
      return true;
    }

    current = current.parentElement;
  }

  return false;
};

const isNonZeroRect = (rect: DOMRect): boolean =>
  Number.isFinite(rect.top) &&
  Number.isFinite(rect.left) &&
  Number.isFinite(rect.width) &&
  Number.isFinite(rect.height) &&
  rect.width > 0 &&
  rect.height > 0;

const intersectsViewport = (rect: DOMRect): boolean => {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight;
};

const isTutorialLayerElement = (element: Element): boolean =>
  Boolean(element.closest(TUTORIAL_LAYER_SELECTOR));

const isTargetTreeElement = (candidate: Element, target: HTMLElement): boolean =>
  candidate === target || target.contains(candidate) || candidate.contains(target);

const isBlockingCoverElement = (element: Element, target: HTMLElement): boolean => {
  if (isTargetTreeElement(element, target)) return false;
  if (isTutorialLayerElement(element)) return false;
  if (element instanceof HTMLElement && window.getComputedStyle(element).pointerEvents === "none") {
    return false;
  }

  return true;
};

const isCoveredAtCenter = (element: HTMLElement, rect: DOMRect): boolean => {
  if (typeof document.elementsFromPoint !== "function") return false;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) return false;

  const visibleLeft = clamp(Math.max(0, rect.left), 0, viewportWidth - 1);
  const visibleRight = clamp(Math.min(viewportWidth, rect.right), 0, viewportWidth - 1);
  const visibleTop = clamp(Math.max(0, rect.top), 0, viewportHeight - 1);
  const visibleBottom = clamp(Math.min(viewportHeight, rect.bottom), 0, viewportHeight - 1);
  const x = (visibleLeft + visibleRight) / 2;
  const y = (visibleTop + visibleBottom) / 2;
  const stack = document.elementsFromPoint(x, y);
  if (stack.length === 0) return false;

  const targetIndex = stack.findIndex((stackElement) => isTargetTreeElement(stackElement, element));
  if (targetIndex === -1) return true;

  return stack.slice(0, targetIndex).some((stackElement) => isBlockingCoverElement(stackElement, element));
};

export const resolveTutorialTarget = (selector: string | null): TutorialTargetResolution | null => {
  if (!selector || typeof document === "undefined") return null;

  let candidates: Element[];
  try {
    candidates = Array.from(document.querySelectorAll(selector));
  } catch {
    return null;
  }

  for (const candidate of candidates) {
    if (!isHTMLElement(candidate)) continue;
    if (!candidate.isConnected) continue;
    if (hasHiddenAncestor(candidate)) continue;

    const rect = candidate.getBoundingClientRect();
    if (!isNonZeroRect(rect)) continue;
    if (!intersectsViewport(rect)) continue;
    if (isCoveredAtCenter(candidate, rect)) continue;

    return {
      selector,
      element: candidate,
      rect,
    };
  }

  return null;
};

export const resolveTutorialTargetFromSelectors = (
  selectors: string[]
): TutorialTargetResolution | null => {
  for (const selector of selectors) {
    const resolved = resolveTutorialTarget(selector);
    if (resolved) return resolved;
  }

  return null;
};
