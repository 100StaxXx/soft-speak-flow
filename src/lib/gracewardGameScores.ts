import { safeLocalStorage } from "@/utils/storage";

export type GracewardGameId = "noahs-pairs" | "scripture-builder" | "bible-quest";
export interface GameScore {
  id: string;
  game: GracewardGameId;
  mode: string;
  score: number;
  stars: number;
  seconds: number;
  completedAt: string;
}
export interface GameRecords { version: 1; bests: Record<string, GameScore>; recent: GameScore[]; rounds: number }
export const GAME_RECORDS_EVENT = "graceward:game-records-updated";
const emptyRecords = (): GameRecords => ({ version: 1, bests: {}, recent: [], rounds: 0 });
export const scoreKey = (game: GracewardGameId, mode: string) => `${game}:${mode}`;
export const gameStorageKey = (playerId?: string) => `graceward:game-records:v1:${playerId || "guest"}`;
const validScore = (value: unknown): value is GameScore => {
  if (!value || typeof value !== "object") return false;
  const r = value as GameScore;
  return typeof r.id === "string" && r.id.length > 0 && r.id.length < 150 &&
    ["noahs-pairs", "scripture-builder", "bible-quest"].includes(r.game) &&
    typeof r.mode === "string" && /^[a-z0-9-]{1,32}$/.test(r.mode) &&
    Number.isInteger(r.score) && r.score >= 0 && r.score <= 1_000_000 &&
    Number.isInteger(r.stars) && r.stars >= 0 && r.stars <= 3 &&
    Number.isFinite(r.seconds) && r.seconds >= 0 && r.seconds <= 86400 &&
    typeof r.completedAt === "string" && Number.isFinite(Date.parse(r.completedAt));
};
export function readGameRecords(playerId?: string): GameRecords {
  try {
    const parsed = JSON.parse(safeLocalStorage.getItem(gameStorageKey(playerId)) || "null");
    if (parsed?.version !== 1 || !Array.isArray(parsed.recent) || !parsed.bests || typeof parsed.bests !== "object") return emptyRecords();
    return {
      version: 1,
      bests: Object.fromEntries(Object.entries(parsed.bests).flatMap(([key, value]) => validScore(value) && key === scoreKey(value.game, value.mode) ? [[key, value] as const] : [])),
      recent: parsed.recent.filter(validScore).slice(0, 30),
      rounds: Number.isSafeInteger(parsed.rounds) && parsed.rounds >= 0 ? parsed.rounds : 0,
    };
  } catch { return emptyRecords(); }
}
export function saveGameScore(playerId: string | undefined, result: GameScore) {
  const records = readGameRecords(playerId);
  if (!validScore(result)) return { saved: false, newBest: false, records };
  const key = scoreKey(result.game, result.mode);
  const previous = records.bests[key];
  if (records.recent.some(row => row.id === result.id) || previous?.id === result.id) {
    return { saved: true, newBest: previous?.id === result.id, records };
  }
  const newBest = !previous || result.score > previous.score;
  const next: GameRecords = {
    version: 1, rounds: records.rounds + 1,
    bests: newBest ? { ...records.bests, [key]: result } : records.bests,
    recent: [result, ...records.recent].slice(0, 30),
  };
  const saved = safeLocalStorage.setItem(gameStorageKey(playerId), JSON.stringify(next));
  if (saved) window.dispatchEvent(new Event(GAME_RECORDS_EVENT));
  return { saved, newBest: saved && newBest, records: saved ? next : records };
}
export const createRoundId = () => typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const formatGameTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export const pairPoints = (streak: number) => 200 + Math.min(Math.max(streak - 1, 0), 4) * 50;
export const pairsTimeBonus = (seconds: number, pairs: number) => Math.max(0, Math.round(pairs * 60 - seconds * 2));
export const versePoints = (mistakes: number, hints: number) => Math.max(100, 500 - mistakes * 40 - hints * 100);
export const questPoints = (answers: readonly number[], correctAnswers: readonly number[]) => {
  let streak = 0;
  return answers.reduce((sum, answer, index) => {
    if (answer !== correctAnswers[index]) { streak = 0; return sum; }
    streak++;
    return sum + 200 + (streak - 1) * 50;
  }, 0);
};
