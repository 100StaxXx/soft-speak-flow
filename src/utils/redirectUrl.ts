import { Capacitor } from '@capacitor/core';
import { PRODUCT, type ProductMode } from '@/config/product';
import { getProductRuntimeIdentity } from '@/config/productRuntime';

/**
 * Read and normalize the production domain used for native (Capacitor) redirects.
 * Throws early if the environment variable is missing so we don't silently
 * send users to a placeholder domain in production builds.
 */
export function resolveNativeRedirectBase(
  configuredBase: string | undefined,
  productMode: ProductMode = PRODUCT.mode,
): string {
  const runtime = getProductRuntimeIdentity(productMode);
  const base = configuredBase?.trim();
  if (!base) {
    throw new Error(`Missing VITE_NATIVE_REDIRECT_BASE for ${runtime.authProductMode} native auth redirects`);
  }

  const normalized = base.endsWith('/') ? base.slice(0, -1) : base;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('VITE_NATIVE_REDIRECT_BASE must be a valid HTTPS origin');
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash ||
    !runtime.webOrigins.includes(parsed.origin)
  ) {
    throw new Error(
      `VITE_NATIVE_REDIRECT_BASE does not belong to the ${runtime.authProductMode} product`,
    );
  }

  return parsed.origin;
}

function getNativeRedirectBase(): string {
  const base = import.meta.env.VITE_NATIVE_REDIRECT_BASE?.trim();
  return resolveNativeRedirectBase(base);
}

/**
 * Get the correct redirect URL for authentication flows.
 * Critical for iOS: window.location.origin doesn't work on Capacitor native platforms.
 *
 * @returns The production domain for native platforms, current origin for web.
 */
export const getRedirectUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    return getNativeRedirectBase();
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
