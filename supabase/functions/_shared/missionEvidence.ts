export interface CompletedTaskEvidence {
  task_text?: unknown;
  completed_at?: unknown;
  task_date?: unknown;
  difficulty?: unknown;
  actual_time_spent?: unknown;
}

export interface MissionThreadEvidence {
  mission_date?: unknown;
  intention_label?: unknown;
  primary_task_title?: unknown;
  status?: unknown;
  completed_at?: unknown;
  reflection_label?: unknown;
}

const normalizeText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const normalizeMinutes = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(24 * 60, Math.round(value));
};

export const NO_VERIFIED_MISSION_EVIDENCE =
  "No verified progress events are available. Keep the scene symbolic and do not invent completed actions, feelings, streaks, or outcomes.";

export function buildMissionEvidenceContext(input: {
  completedTasks?: CompletedTaskEvidence[] | null;
  missionThreads?: MissionThreadEvidence[] | null;
}): string {
  const lines: string[] = [];
  const seenTaskTitles = new Set<string>();

  for (const thread of input.missionThreads ?? []) {
    if (thread.status !== "completed" && thread.status !== "reflected") continue;
    const title = normalizeText(thread.primary_task_title, 220);
    if (!title) continue;
    const date = normalizeText(thread.mission_date, 20) ?? "recently";
    const intention = normalizeText(thread.intention_label, 80) ?? "Make progress";
    const reflection = normalizeText(thread.reflection_label, 120);
    lines.push(
      `- Daily mission completed on ${date}: “${title}” (intention: ${intention}${reflection ? `; user reflection: ${reflection}` : ""}).`,
    );
    seenTaskTitles.add(title.toLowerCase());
    if (lines.length >= 7) break;
  }

  for (const task of input.completedTasks ?? []) {
    const title = normalizeText(task.task_text, 220);
    if (!title || seenTaskTitles.has(title.toLowerCase())) continue;
    const date = normalizeText(task.task_date, 20)
      ?? normalizeText(task.completed_at, 30)?.slice(0, 10)
      ?? "recently";
    const difficulty = normalizeText(task.difficulty, 20);
    const minutes = normalizeMinutes(task.actual_time_spent);
    const details = [difficulty ? `${difficulty} difficulty` : null, minutes ? `${minutes} minutes logged` : null]
      .filter(Boolean)
      .join(", ");
    lines.push(`- Quest completed on ${date}: “${title}”${details ? ` (${details})` : ""}.`);
    seenTaskTitles.add(title.toLowerCase());
    if (lines.length >= 12) break;
  }

  return lines.length > 0 ? lines.join("\n") : NO_VERIFIED_MISSION_EVIDENCE;
}
