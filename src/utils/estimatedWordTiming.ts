export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

function wordWeight(word: string): number {
  const letters = (word.match(/[\p{L}\p{N}]/gu) ?? []).length;
  const readingWeight = Math.max(0.75, Math.min(2.1, 0.55 + letters * 0.115));
  const pauseWeight = /[.!?][”"')\]]?$/u.test(word)
    ? 0.8
    : /[,;:][”"')\]]?$/u.test(word)
      ? 0.35
      : 0;
  return readingWeight + pauseWeight;
}

/**
 * Guarantees a usable follow-along transcript when a legacy audio file has not
 * received authoritative provider timing yet. Exact ElevenLabs timing always
 * takes precedence when present.
 */
export function estimateWordTiming(script: string, duration: number): TimedWord[] {
  const words = script.trim().match(/\S+/gu) ?? [];
  if (words.length === 0 || !Number.isFinite(duration) || duration <= 0) {
    return [];
  }

  const leadIn = Math.min(0.3, duration * 0.015);
  const usableDuration = Math.max(0.01, duration - leadIn);
  const weights = words.map(wordWeight);
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let cursor = leadIn;

  return words.map((word, index) => {
    const start = cursor;
    const end = index === words.length - 1
      ? duration
      : Math.min(duration, start + (weights[index] / totalWeight) * usableDuration);
    cursor = end;
    return { word, start, end: Math.max(start + 0.01, end) };
  });
}
