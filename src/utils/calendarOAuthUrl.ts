const OAUTH_URL_KEYS = ['url', 'auth_url', 'authUrl'] as const;

const readCandidate = (payload: unknown): unknown => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{')) {
      try {
        return readCandidate(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }

    return trimmed;
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const record = payload as Record<string, unknown>;
  for (const key of OAUTH_URL_KEYS) {
    if (record[key] !== undefined) return record[key];
  }

  return null;
};

export const parseCalendarOAuthUrl = (payload: unknown): string => {
  const candidate = readCandidate(payload);
  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new Error('The calendar provider did not return a sign-in link. Please try again.');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate.trim());
  } catch {
    throw new Error('The calendar provider returned an invalid sign-in link. Please try again.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('The calendar sign-in link was not secure. Please update Cosmiq and try again.');
  }

  return parsed.toString();
};
