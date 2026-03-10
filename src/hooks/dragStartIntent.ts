const LEGACY_INTERACTIVE_SELECTOR = '[data-interactive="true"]';
const TAP_CONTROL_SELECTOR = '[data-tap-control="true"]';

export type DragStartIntent = "allow" | "ignore";

const buildDragHandleSelector = (handleId: string) => `[data-drag-handle="${handleId}"]`;

export const resolveDragStartIntent = (
  target: EventTarget | null,
  dragHandleId: string,
): DragStartIntent => {
  if (!(target instanceof Element)) return "allow";

  // Dedicated drag handles can remain interactive controls but still initiate drag.
  if (target.closest(buildDragHandleSelector(dragHandleId))) return "allow";

  if (target.closest(TAP_CONTROL_SELECTOR)) return "ignore";
  if (target.closest(LEGACY_INTERACTIVE_SELECTOR)) return "ignore";

  return "allow";
};
