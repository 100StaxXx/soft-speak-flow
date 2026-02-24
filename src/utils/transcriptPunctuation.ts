export interface TimedTranscriptWord {
  word: string;
  start: number;
  end: number;
}

const TOKEN_LOOKAHEAD = 8;
const NON_ALNUM_UNICODE = /[^\p{L}\p{N}]+/gu;

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(NON_ALNUM_UNICODE, "");
}

/**
 * Re-applies punctuation/casing from script tokens onto timed words when tokens align.
 * Keeps timing and ordering unchanged so active-word highlighting still works.
 */
export function applyScriptPunctuationToTranscript<T extends TimedTranscriptWord>(
  transcript: T[],
  script: string | null | undefined,
): T[] {
  if (!script || transcript.length === 0) {
    return transcript;
  }

  const scriptTokens = script.match(/\S+/g);
  if (!scriptTokens || scriptTokens.length === 0) {
    return transcript;
  }

  let scriptCursor = 0;
  let didChange = false;

  const punctuatedTranscript = transcript.map((timedWord) => {
    const normalizedWord = normalizeToken(timedWord.word);
    if (!normalizedWord) {
      return timedWord;
    }

    let matchedIndex = -1;
    const searchLimit = Math.min(scriptTokens.length - 1, scriptCursor + TOKEN_LOOKAHEAD);

    for (let index = scriptCursor; index <= searchLimit; index += 1) {
      if (normalizeToken(scriptTokens[index]) === normalizedWord) {
        matchedIndex = index;
        break;
      }
    }

    if (matchedIndex === -1) {
      return timedWord;
    }

    scriptCursor = matchedIndex + 1;
    const matchedToken = scriptTokens[matchedIndex];

    if (matchedToken === timedWord.word) {
      return timedWord;
    }

    didChange = true;
    return {
      ...timedWord,
      word: matchedToken,
    };
  });

  return didChange ? punctuatedTranscript : transcript;
}
