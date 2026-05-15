export type CompanionLatencyMetricName =
  | "companion_fab_popup_visible"
  | "companion_chat_composer_ready"
  | "companion_send_assistant_bubble";

export interface CompanionLatencyTimer {
  id: string;
  metricName: CompanionLatencyMetricName;
  startedAt: number;
  details?: Record<string, unknown>;
}

let metricSequence = 0;

const hasPerformance = () =>
  typeof performance !== "undefined" &&
  typeof performance.now === "function";

const isDevRuntime = () => {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
};

const markPerformance = (name: string) => {
  if (!hasPerformance() || typeof performance.mark !== "function") return;

  try {
    performance.mark(name);
  } catch {
    // Performance marks are best-effort only.
  }
};

const measurePerformance = (
  name: string,
  startMark: string,
  endMark: string,
) => {
  if (!hasPerformance() || typeof performance.measure !== "function") return;

  try {
    performance.measure(name, startMark, endMark);
  } catch {
    // Missing marks should never affect the UI path.
  }
};

export const startCompanionLatencyTimer = (
  metricName: CompanionLatencyMetricName,
  details?: Record<string, unknown>,
): CompanionLatencyTimer | null => {
  if (!hasPerformance()) return null;

  metricSequence += 1;
  const id = `${metricName}:${metricSequence}`;
  markPerformance(`${id}:start`);

  return {
    id,
    metricName,
    startedAt: performance.now(),
    details,
  };
};

export const finishCompanionLatencyTimer = (
  timer: CompanionLatencyTimer | null | undefined,
  details?: Record<string, unknown>,
): number | null => {
  if (!timer || !hasPerformance()) return null;

  const endedAt = performance.now();
  const durationMs = Math.max(0, endedAt - timer.startedAt);
  const roundedDurationMs = Math.round(durationMs * 10) / 10;
  const endMark = `${timer.id}:end`;

  markPerformance(endMark);
  measurePerformance(timer.metricName, `${timer.id}:start`, endMark);

  if (isDevRuntime()) {
    console.debug("[companion-latency]", timer.metricName, {
      durationMs: roundedDurationMs,
      ...timer.details,
      ...details,
    });
  }

  return roundedDurationMs;
};
