import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';
import { PRODUCT, type ProductMode } from '@/config/product';
import {
  getProductRuntimeIdentity,
  type ProductRuntimeIdentity,
} from '@/config/productRuntime';

export type CalendarOAuthProvider = 'google' | 'outlook';
export type CalendarOAuthStatus = 'success' | 'error';

const AUTH_RESET_PATH = '/auth/reset-password';
const CALENDAR_OAUTH_CALLBACK_PATH = '/calendar/oauth/callback';
const JOIN_EPIC_PATH = '/join';
const JOURNEYS_PATH = '/journeys';
const TODAY_PATH = '/mentor';
const CALENDAR_CALLBACK_ORIGIN_PARAM = 'calendar_callback_origin';

export interface DeepLinkData {
  type: 'task' | 'today' | 'calendar_oauth' | 'calendar_oauth_callback' | 'auth_recovery' | 'join_epic' | 'journeys' | 'unknown';
  taskId?: string;
  provider?: CalendarOAuthProvider;
  status?: CalendarOAuthStatus;
  message?: string;
  path?: string;
  rawUrl: string;
}

const getHostedAppLinkHosts = (runtime: ProductRuntimeIdentity): Set<string> =>
  new Set(runtime.webOrigins.map((origin) => new URL(origin).hostname));

const isCurrentProductScheme = (
  protocol: string,
  runtime: ProductRuntimeIdentity,
): boolean =>
  protocol === `${runtime.nativeScheme}:` || protocol === `${runtime.iosBundleId}:`;

const isNativeAuthRecoveryLink = (
  parsed: URL,
  runtime: ProductRuntimeIdentity,
): boolean => {
  const isWebRecoveryLink = (
    ['https:', 'http:'].includes(parsed.protocol) &&
    getHostedAppLinkHosts(runtime).has(parsed.hostname) &&
    parsed.pathname === AUTH_RESET_PATH
  );

  const isSchemeRecoveryLink = (
    isCurrentProductScheme(parsed.protocol, runtime) &&
    (
      (parsed.hostname === 'auth' && parsed.pathname === '/reset-password') ||
      parsed.pathname === AUTH_RESET_PATH
    )
  );

  return (isWebRecoveryLink || isSchemeRecoveryLink) && parsed.hash.includes('type=recovery');
};

const isHostedCalendarOAuthCallbackLink = (
  parsed: URL,
  runtime: ProductRuntimeIdentity,
): boolean => (
  ['https:', 'http:'].includes(parsed.protocol) &&
  getHostedAppLinkHosts(runtime).has(parsed.hostname) &&
  parsed.pathname === CALENDAR_OAUTH_CALLBACK_PATH
);

const isNativeJoinEpicLink = (
  parsed: URL,
  runtime: ProductRuntimeIdentity,
): boolean => (
  runtime.authProductMode === 'cosmiq' &&
  isCurrentProductScheme(parsed.protocol, runtime) &&
  parsed.hostname === 'join' &&
  parsed.pathname.length > 1
);

const isNativeJourneysLink = (
  parsed: URL,
  runtime: ProductRuntimeIdentity,
): boolean => (
  runtime.authProductMode === 'cosmiq' &&
  isCurrentProductScheme(parsed.protocol, runtime) &&
  parsed.hostname === 'journeys' &&
  (parsed.pathname === '' || parsed.pathname === '/' || parsed.pathname === '/plan')
);

const buildHostedCalendarOAuthCallbackPath = (parsed: URL): string => {
  const params = new URLSearchParams(parsed.search);
  params.set(CALENDAR_CALLBACK_ORIGIN_PARAM, parsed.origin);
  const search = params.toString();
  return `${CALENDAR_OAUTH_CALLBACK_PATH}${search ? `?${search}` : ''}${parsed.hash}`;
};

/**
 * Parse incoming native deep links and universal links
 */
export const parseDeepLinkForProduct = (
  url: string,
  productMode: ProductMode,
): DeepLinkData => {
  const runtime = getProductRuntimeIdentity(productMode);
  try {
    if (url === `${runtime.nativeScheme}://today`) {
      return { type: 'today', path: TODAY_PATH, rawUrl: url };
    }

    const taskPrefix = `${runtime.nativeScheme}://task/`;
    if (url.startsWith(taskPrefix)) {
      const taskId = url.slice(taskPrefix.length).split('?')[0];
      return { type: 'task', taskId, rawUrl: url };
    }

    if (url.startsWith(`${runtime.nativeScheme}://calendar/oauth/callback`)) {
      const parsed = new URL(url);
      const providerRaw = parsed.searchParams.get('provider');
      const statusRaw = parsed.searchParams.get('status');
      const message = parsed.searchParams.get('message') ?? undefined;

      const provider = providerRaw === 'google' || providerRaw === 'outlook' ? providerRaw : undefined;
      const status = statusRaw === 'success' || statusRaw === 'error' ? statusRaw : undefined;

      return {
        type: 'calendar_oauth',
        provider,
        status,
        message,
        rawUrl: url,
      };
    }

    const parsed = new URL(url);

    if (isNativeJourneysLink(parsed, runtime)) {
      return {
        type: 'journeys',
        path: JOURNEYS_PATH,
        rawUrl: url,
      };
    }

    if (isNativeJoinEpicLink(parsed, runtime)) {
      return {
        type: 'join_epic',
        path: `${JOIN_EPIC_PATH}${parsed.pathname}`,
        rawUrl: url,
      };
    }

    if (isHostedCalendarOAuthCallbackLink(parsed, runtime)) {
      return {
        type: 'calendar_oauth_callback',
        path: buildHostedCalendarOAuthCallbackPath(parsed),
        rawUrl: url,
      };
    }

    if (isNativeAuthRecoveryLink(parsed, runtime)) {
      return {
        type: 'auth_recovery',
        path: `${AUTH_RESET_PATH}${parsed.search}${parsed.hash}`,
        rawUrl: url,
      };
    }
    
    return { type: 'unknown', rawUrl: url };
  } catch (error) {
    logger.error('[DeepLink] Failed to parse URL:', error);
    return { type: 'unknown', rawUrl: url };
  }
};

export const parseDeepLink = (url: string): DeepLinkData =>
  parseDeepLinkForProduct(url, PRODUCT.mode);

/**
 * Initialize deep link listener for native platforms
 * Returns cleanup function
 */
export const initializeDeepLinkHandler = (
  onDeepLink: (data: DeepLinkData) => void
): (() => void) => {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let listenerHandle: { remove: () => void } | null = null;

  // Handle app opened with URL (cold start)
  App.getLaunchUrl().then((result) => {
    if (result?.url) {
      logger.log('[DeepLink] App launched with URL:', result.url);
      const data = parseDeepLink(result.url);
      onDeepLink(data);
    }
  });

  // Handle URL opened while app is running (warm start)
  App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    logger.log('[DeepLink] App URL opened:', event.url);
    const data = parseDeepLink(event.url);
    onDeepLink(data);
  }).then((handle) => {
    listenerHandle = handle;
  });

  return () => {
    listenerHandle?.remove();
  };
};
