import { safeSessionStorage } from "@/utils/storage";

export const AUTH_SESSION_KEY = "sb-opbfpbbqvuksuvmtmssd-auth-token";
export const AUTH_FRESH_SIGN_IN_KEY = "cosmiq.auth.fresh-sign-in";

interface SessionStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** A fresh runtime/login route; does not wait for or revoke a stuck session. */
export const returnToSignIn = () => {
  safeSessionStorage.setItem(AUTH_FRESH_SIGN_IN_KEY, "1");
  window.location.replace("/auth?mode=login&recovery=1");
};

/**
 * Only an explicit recovery action skips the old token for this runtime.
 * Keep it securely stored until a successful sign-in saves its replacement.
 * No fabricated session, unlocked route, remote sign-out or account deletion.
 */
export const createRecoverableAuthStorage = (
  storage: SessionStorageAdapter,
  freshSignIn = safeSessionStorage.getItem(AUTH_FRESH_SIGN_IN_KEY) === "1" ||
    (window.location.pathname === "/auth" && new URLSearchParams(window.location.search).get("recovery") === "1"),
): SessionStorageAdapter => {
  let awaitingFreshSession = freshSignIn;
  return {
    async getItem(key) {
      if (awaitingFreshSession && key === AUTH_SESSION_KEY) return null;
      return storage.getItem(key);
    },
    async setItem(key, value) {
      await storage.setItem(key, value);
      if (key === AUTH_SESSION_KEY && awaitingFreshSession) {
        awaitingFreshSession = false;
        safeSessionStorage.removeItem(AUTH_FRESH_SIGN_IN_KEY);
        const url = new URL(window.location.href);
        url.searchParams.delete("recovery");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      }
    },
    async removeItem(key) {
      if (awaitingFreshSession && key === AUTH_SESSION_KEY) return;
      await storage.removeItem(key);
    },
  };
};
