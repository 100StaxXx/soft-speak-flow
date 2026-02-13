export type DragSnapMode = "coarse" | "fine";
export type PrecisionActivationMode = "manual-hold" | "auto-dwell" | "none";

export interface AdaptiveSnapConfig {
  coarseStepMinutes: number;
  fineStepMinutes: number;
  minMinute: number;
  maxMinute: number;
  coarseHoursPerViewport: number;
  fineHoursPerViewport: number;
  precisionActivationMode: PrecisionActivationMode;
  precisionHoldMs: number;
  precisionHoldMovementPx: number;
  precisionActivationWindowPx: number;
  precisionExitMovementPx: number;
  zoomTickCount: number;
}

export interface AdaptiveSnapRuntimeScale {
  viewportHeight: number;
  coarsePixelsPerMinute: number;
  finePixelsPerMinute: number;
}

export interface DragZoomRailTick {
  minute: number;
  label: string;
  isCenter: boolean;
  isMajor: boolean;
}

export interface DragZoomRailState {
  mode: DragSnapMode;
  clientY: number;
  snappedMinute: number;
  ticks: DragZoomRailTick[];
}

export interface ComputeAdaptiveMinuteParams {
  startMinute: number;
  startClientY: number;
  currentClientY: number;
  mode: DragSnapMode;
  lastSnappedMinute: number;
  fineAnchorMinute: number | null;
  fineAnchorClientY: number | null;
  runtimeScale?: AdaptiveSnapRuntimeScale;
  config?: Partial<AdaptiveSnapConfig>;
}

export interface ComputeAdaptiveMinuteResult {
  rawMinute: number;
  snappedMinute: number;
  fineAnchorMinute: number | null;
  fineAnchorClientY: number | null;
}

const DEFAULT_ADAPTIVE_SNAP_CONFIG: AdaptiveSnapConfig = {
  coarseStepMinutes: 15,
  fineStepMinutes: 5,
  minMinute: 0,
  maxMinute: (24 * 60) - 5,
  coarseHoursPerViewport: 6,
  fineHoursPerViewport: 2,
  precisionActivationMode: "manual-hold",
  precisionHoldMs: 220,
  precisionHoldMovementPx: 14,
  precisionActivationWindowPx: 72,
  precisionExitMovementPx: 96,
  zoomTickCount: 7,
};

const DEFAULT_RUNTIME_VIEWPORT_HEIGHT = 720;
const MIN_RUNTIME_VIEWPORT_HEIGHT = 320;

export const resolveAdaptiveSnapConfig = (
  overrides?: Partial<AdaptiveSnapConfig>,
): AdaptiveSnapConfig => ({
  ...DEFAULT_ADAPTIVE_SNAP_CONFIG,
  ...overrides,
});

export const SHARED_TIMELINE_DRAG_PROFILE: Readonly<Partial<AdaptiveSnapConfig>> = Object.freeze({
  coarseStepMinutes: 15,
  fineStepMinutes: 5,
  coarseHoursPerViewport: 6,
  fineHoursPerViewport: 2,
  precisionActivationMode: "manual-hold",
});

export const clampMinuteToRange = (
  minute: number,
  config?: Partial<AdaptiveSnapConfig>,
): number => {
  const resolved = resolveAdaptiveSnapConfig(config);
  return Math.max(resolved.minMinute, Math.min(resolved.maxMinute, Math.round(minute)));
};

const snapMinuteToStep = (
  minute: number,
  stepMinutes: number,
  config?: Partial<AdaptiveSnapConfig>,
): number => {
  const resolved = resolveAdaptiveSnapConfig(config);
  const safeStep = Math.max(1, stepMinutes);
  const rounded = Math.round(minute / safeStep) * safeStep;
  return clampMinuteToRange(rounded, resolved);
};

export const snapMinuteByMode = (
  minute: number,
  mode: DragSnapMode,
  config?: Partial<AdaptiveSnapConfig>,
): number => {
  const resolved = resolveAdaptiveSnapConfig(config);
  const step = mode === "coarse" ? resolved.coarseStepMinutes : resolved.fineStepMinutes;
  return snapMinuteToStep(minute, step, resolved);
};

export const minuteToTime24 = (
  minute: number,
  config?: Partial<AdaptiveSnapConfig>,
): string => {
  const clamped = clampMinuteToRange(minute, config);
  const hour = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const time24ToMinute = (
  time: string,
  config?: Partial<AdaptiveSnapConfig>,
): number => {
  const [hourPart, minutePart] = time.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return clampMinuteToRange(0, config);
  }
  return clampMinuteToRange((hour * 60) + minute, config);
};

export const buildAdaptiveSnapRuntimeScale = (
  config?: Partial<AdaptiveSnapConfig>,
  viewportHeight: number = DEFAULT_RUNTIME_VIEWPORT_HEIGHT,
): AdaptiveSnapRuntimeScale => {
  const resolved = resolveAdaptiveSnapConfig(config);
  const safeViewportHeight = Math.max(
    MIN_RUNTIME_VIEWPORT_HEIGHT,
    Math.round(Number.isFinite(viewportHeight) ? viewportHeight : DEFAULT_RUNTIME_VIEWPORT_HEIGHT),
  );

  const coarsePixelsPerMinute = safeViewportHeight / Math.max(60, resolved.coarseHoursPerViewport * 60);
  const finePixelsPerMinute = safeViewportHeight / Math.max(60, resolved.fineHoursPerViewport * 60);

  return {
    viewportHeight: safeViewportHeight,
    coarsePixelsPerMinute: Math.max(0.1, coarsePixelsPerMinute),
    finePixelsPerMinute: Math.max(0.1, finePixelsPerMinute),
  };
};

const formatMinuteLabel = (minute: number): string => {
  const clamped = clampMinuteToRange(minute);
  const hour24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "p" : "a";
  return `${hour12}:${String(mins).padStart(2, "0")}${suffix}`;
};

export const minuteFromRowOffset = (
  slotStartMinute: number,
  offsetY: number,
  rowHeightPx: number,
  config?: Partial<AdaptiveSnapConfig>,
): number => {
  if (rowHeightPx <= 0) {
    return clampMinuteToRange(slotStartMinute, config);
  }

  const clampedOffset = Math.max(0, Math.min(rowHeightPx, offsetY));
  const minutesIntoRow = (clampedOffset / rowHeightPx) * 30;
  return clampMinuteToRange(slotStartMinute + minutesIntoRow, config);
};

export const computeAdaptiveMinute = (
  params: ComputeAdaptiveMinuteParams,
): ComputeAdaptiveMinuteResult => {
  const resolved = resolveAdaptiveSnapConfig(params.config);
  const runtimeScale = params.runtimeScale ?? buildAdaptiveSnapRuntimeScale(resolved);

  if (params.mode === "coarse") {
    const deltaY = params.currentClientY - params.startClientY;
    const rawMinute = params.startMinute + (deltaY / runtimeScale.coarsePixelsPerMinute);
    const snappedMinute = snapMinuteByMode(rawMinute, "coarse", resolved);
    return {
      rawMinute,
      snappedMinute,
      fineAnchorMinute: params.fineAnchorMinute,
      fineAnchorClientY: params.fineAnchorClientY,
    };
  }

  const fineAnchorMinute = params.fineAnchorMinute ?? params.lastSnappedMinute;
  const fineAnchorClientY = params.fineAnchorClientY ?? params.currentClientY;
  const fineDeltaY = params.currentClientY - fineAnchorClientY;
  const rawMinute = fineAnchorMinute + (fineDeltaY / runtimeScale.finePixelsPerMinute);
  const snappedMinute = snapMinuteByMode(rawMinute, "fine", resolved);

  return {
    rawMinute,
    snappedMinute,
    fineAnchorMinute,
    fineAnchorClientY,
  };
};

export const buildDragZoomRailState = (
  mode: DragSnapMode,
  clientY: number,
  snappedMinute: number,
  config?: Partial<AdaptiveSnapConfig>,
): DragZoomRailState => {
  const resolved = resolveAdaptiveSnapConfig(config);
  const step = mode === "fine" ? resolved.fineStepMinutes : resolved.coarseStepMinutes;
  const half = Math.floor(Math.max(3, resolved.zoomTickCount) / 2);
  const centerMinute = snapMinuteByMode(snappedMinute, mode, resolved);

  const seen = new Set<number>();
  const ticks: DragZoomRailTick[] = [];

  for (let i = -half; i <= half; i += 1) {
    const minute = clampMinuteToRange(centerMinute + (i * step), resolved);
    if (seen.has(minute)) continue;
    seen.add(minute);

    ticks.push({
      minute,
      label: formatMinuteLabel(minute),
      isCenter: i === 0,
      isMajor: minute % 60 === 0 || minute % resolved.coarseStepMinutes === 0,
    });
  }

  return {
    mode,
    clientY,
    snappedMinute: centerMinute,
    ticks,
  };
};
