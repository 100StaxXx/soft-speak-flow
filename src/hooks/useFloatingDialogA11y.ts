import { RefObject, useEffect } from "react";

interface FloatingDialogA11yOptions {
  open: boolean;
  onClose: () => void;
  initialFocusRef: RefObject<HTMLElement>;
}

export function useFloatingDialogA11y({
  open,
  onClose,
  initialFocusRef,
}: FloatingDialogA11yOptions) {
  useEffect(() => {
    if (!open) return;

    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      initialFocusRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, [initialFocusRef, onClose, open]);
}
