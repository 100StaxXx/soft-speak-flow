import { DragZoomRailState } from "./dragSnap";

interface DragTimeZoomRailProps {
  rail: DragZoomRailState | null;
  className?: string;
}

export function DragTimeZoomRail({ rail, className }: DragTimeZoomRailProps) {
  void rail;
  void className;
  return null;
}
