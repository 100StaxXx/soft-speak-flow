import { Capacitor } from '@capacitor/core';

/**
 * Get the correct redirect URL for authentication flows
 * Critical for iOS: window.location.origin doesn't work on Capacitor native platforms
 * 
 * @returns The production domain for native platforms, current origin for web
 */
export const getRedirectUrl = (): string => {
  // For native iOS/Android, use the production domain
  if (Capacitor.isNativePlatform()) {
    return 'https://app.cosmiq.quest';
  }
  
  // For web, use current origin
  return window.location.origin;
};

/**
 * Get the full redirect URL with path
 * @param path - Optional path to append (defaults to '/')
 */
export const getRedirectUrlWithPath = (path: string = '/'): string => {
  const baseUrl = getRedirectUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};
