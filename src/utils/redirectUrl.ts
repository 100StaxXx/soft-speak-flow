import { Capacitor } from '@capacitor/core';

/**
 * Read and normalize the production domain used for native (Capacitor) redirects.
 * Throws early if the environment variable is missing so we don't silently
 * send users to a placeholder domain in production builds.
 */
function getNativeRedirectBase(): string {
  const base = import.meta.env.VITE_NATIVE_REDIRECT_BASE?.trim();
  if (!base) {
    throw new Error('Missing VITE_NATIVE_REDIRECT_BASE for native auth redirects');
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/**
 * Get the correct redirect URL for authentication flows.
 * Critical for iOS: window.location.origin doesn't work on Capacitor native platforms.
 *
 * @returns The production domain for native platforms, current origin for web.
 */
const NATIVE_REDIRECT_BASE = import.meta.env.VITE_NATIVE_REDIRECT_BASE;

export const getRedirectUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    return getNativeRedirectBase();
    return 'https://app.cosmiq.quest';
    if (!NATIVE_REDIRECT_BASE) {
      throw new Error('Missing VITE_NATIVE_REDIRECT_BASE for native auth redirects');
    }
    return NATIVE_REDIRECT_BASE;
  }

  return window.location.origin;
};

/**
 * Get the full redirect URL with path
 * @param path - Optional path to append (defaults to '/')
 */
export const getRedirectUrlWithPath = (path: string = '/'): string => {
  const baseUrl = getRedirectUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
