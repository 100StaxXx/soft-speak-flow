export interface TimedTranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface ElevenLabsCharacterAlignment {
  characters?: unknown;
  character_start_times_seconds?: unknown;
  character_end_times_seconds?: unknown;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Converts ElevenLabs character timing into the compact word timing shape used
 * by the clients. Punctuation remains attached to the word it follows so the
 * highlighted transcript reads exactly like the generated script.
 */
export function characterAlignmentToWords(
  alignment: ElevenLabsCharacterAlignment | null | undefined,
): TimedTranscriptWord[] {
  if (!alignment) return [];

  const characters = Array.isArray(alignment.characters)
    ? alignment.characters
    : [];
  const starts = Array.isArray(alignment.character_start_times_seconds)
    ? alignment.character_start_times_seconds
    : [];
  const ends = Array.isArray(alignment.character_end_times_seconds)
    ? alignment.character_end_times_seconds
    : [];

  if (
    characters.length === 0 ||
    characters.length !== starts.length ||
    characters.length !== ends.length
  ) {
    return [];
  }

  const transcript: TimedTranscriptWord[] = [];
  let word = "";
  let wordStart = 0;
  let wordEnd = 0;

  const flush = () => {
    const normalizedWord = word.trim();
    if (normalizedWord && wordEnd >= wordStart) {
      transcript.push({
        word: normalizedWord,
        start: wordStart,
        end: Math.max(wordEnd, wordStart + 0.01),
      });
    }
    word = "";
  };

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const start = starts[index];
    const end = ends[index];

    if (
      typeof character !== "string" ||
      !isFiniteNumber(start) ||
      !isFiniteNumber(end)
    ) {
      return [];
    }

    if (/\s/u.test(character)) {
      flush();
      continue;
    }

    if (word.length === 0) {
      wordStart = start;
    }
    word += character;
    wordEnd = end;
  }

  flush();
  return transcript;
}

export function forcedAlignmentToWords(payload: unknown): TimedTranscriptWord[] {
  if (!payload || typeof payload !== "object") return [];

  const words = (payload as { words?: unknown }).words;
  if (!Array.isArray(words)) return [];

  return words.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const word = candidate as { text?: unknown; start?: unknown; end?: unknown };
    if (
      typeof word.text !== "string" ||
      !word.text.trim() ||
      !isFiniteNumber(word.start) ||
      !isFiniteNumber(word.end)
    ) {
      return [];
    }

    return [{
      word: word.text.trim(),
      start: word.start,
      end: Math.max(word.end, word.start + 0.01),
    }];
  });
}

export function decodeBase64Audio(base64: string): Uint8Array {
  const normalized = base64.trim();
  if (!normalized) throw new Error("ElevenLabs response missing audio_base64");

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
