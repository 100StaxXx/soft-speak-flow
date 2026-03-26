const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_SUFFIX_PATTERN = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const ID_LIKE_CAMEL_CASE_PATTERN = /^[a-z][a-zA-Z0-9]*Id$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shouldNormalizeKey(key: string): boolean {
  return key === "id" || key.endsWith("_id") || ID_LIKE_CAMEL_CASE_PATTERN.test(key);
}

export function normalizeUuidLikeId(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return trimmed;

  if (UUID_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const suffixMatch = trimmed.match(UUID_SUFFIX_PATTERN);
  if (suffixMatch) {
    return suffixMatch[1].toLowerCase();
  }

  return trimmed;
}

export function createClientUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = token === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function normalizeUuidFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeUuidFields(entry)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => {
      if (typeof entryValue === "string" && shouldNormalizeKey(key)) {
        return [key, normalizeUuidLikeId(entryValue)];
      }

      return [key, normalizeUuidFields(entryValue)];
    }),
  ) as T;
}
