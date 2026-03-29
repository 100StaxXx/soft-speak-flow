import { safeSessionStorage } from "./storage";

export type SocialAuthProvider = "apple" | "google";
export type SocialAuthIntent = "sign_in" | "sign_up";

export interface PendingSocialAuthAttempt {
  provider: SocialAuthProvider;
  intent: SocialAuthIntent;
}

const PENDING_SOCIAL_AUTH_STORAGE_KEY = "pending_social_auth_attempt";

const isSocialAuthProvider = (value: unknown): value is SocialAuthProvider =>
  value === "apple" || value === "google";

const isSocialAuthIntent = (value: unknown): value is SocialAuthIntent =>
  value === "sign_in" || value === "sign_up";

export const getSocialAuthIntent = (isLogin: boolean): SocialAuthIntent =>
  isLogin ? "sign_in" : "sign_up";

export const getSocialAuthProviderLabel = (provider: SocialAuthProvider): string =>
  provider === "apple" ? "Apple" : "Google";

export const getSocialAccountNotFoundMessage = (provider: SocialAuthProvider): string =>
  `We couldn't find an existing account for ${getSocialAuthProviderLabel(provider)} sign-in. Use your original sign-in method, or switch to Sign up with ${getSocialAuthProviderLabel(provider)} if you're new.`;

export const storePendingSocialAuthAttempt = (attempt: PendingSocialAuthAttempt): boolean =>
  safeSessionStorage.setItem(PENDING_SOCIAL_AUTH_STORAGE_KEY, JSON.stringify(attempt));

export const readPendingSocialAuthAttempt = (): PendingSocialAuthAttempt | null => {
  const raw = safeSessionStorage.getItem(PENDING_SOCIAL_AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const provider = (parsed as { provider?: unknown }).provider;
    const intent = (parsed as { intent?: unknown }).intent;
    if (!isSocialAuthProvider(provider) || !isSocialAuthIntent(intent)) {
      return null;
    }

    return { provider, intent };
  } catch {
    return null;
  }
};

export const clearPendingSocialAuthAttempt = (): boolean =>
  safeSessionStorage.removeItem(PENDING_SOCIAL_AUTH_STORAGE_KEY);
