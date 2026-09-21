const AUTH_RETURN_PATH_STORAGE_KEY = "cosmiq.authReturnPath.v1";
const SAFE_RETURN_PATH = /^\/join\/[A-Za-z0-9_-]+$/;

export const normalizeAuthReturnPath = (value: string | null | undefined): string | null => {
  if (!value) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }

  return SAFE_RETURN_PATH.test(decoded) ? decoded : null;
};

export const rememberAuthReturnPath = (value: string | null | undefined): string | null => {
  const path = normalizeAuthReturnPath(value);
  if (!path || typeof window === "undefined") return path;

  window.sessionStorage.setItem(AUTH_RETURN_PATH_STORAGE_KEY, path);
  return path;
};

export const peekAuthReturnPath = (): string | null => {
  if (typeof window === "undefined") return null;
  return normalizeAuthReturnPath(window.sessionStorage.getItem(AUTH_RETURN_PATH_STORAGE_KEY));
};

export const consumeAuthReturnPath = (): string | null => {
  const path = peekAuthReturnPath();
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(AUTH_RETURN_PATH_STORAGE_KEY);
  }
  return path;
};
