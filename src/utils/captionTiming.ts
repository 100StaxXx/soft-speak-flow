export interface CaptionWord {
  start: number;
  end: number;
}

function isWordActive(word: CaptionWord, currentTime: number): boolean {
  return currentTime >= word.start && currentTime < word.end;
}

export function getActiveWordIndex(
  transcript: CaptionWord[],
  currentTime: number,
  previousIndex?: number,
): number {
  if (!Number.isFinite(currentTime) || transcript.length === 0) {
    return -1;
  }

  if (
    typeof previousIndex === "number" &&
    Number.isInteger(previousIndex) &&
    previousIndex >= 0 &&
    previousIndex < transcript.length
  ) {
    const previousWord = transcript[previousIndex];
    if (isWordActive(previousWord, currentTime)) {
      return previousIndex;
    }

    const nextIndex = previousIndex + 1;
    if (nextIndex < transcript.length && isWordActive(transcript[nextIndex], currentTime)) {
      return nextIndex;
    }

    const priorIndex = previousIndex - 1;
    if (priorIndex >= 0 && isWordActive(transcript[priorIndex], currentTime)) {
      return priorIndex;
    }
  }

  let left = 0;
  let right = transcript.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const word = transcript[mid];

    if (currentTime < word.start) {
      right = mid - 1;
      continue;
    }

    if (currentTime >= word.end) {
      left = mid + 1;
      continue;
    }

    return mid;
  }

  return -1;
}
