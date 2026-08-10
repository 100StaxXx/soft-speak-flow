import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

export type CalendarOAuthProvider = 'google' | 'outlook';
export type CalendarOAuthStatus = 'success' | 'error';

const AUTH_RESET_PATH = '/auth/reset-password';
const CALENDAR_OAUTH_CALLBACK_PATH = '/calendar/oauth/callback';
const JOIN_EPIC_PATH = '/join';
const JOURNEYS_PATH = '/journeys';
const HOSTED_APP_LINK_HOSTS = new Set(['app.cosmiq.quest', 'cosmiq.quest']);
const APP_SCHEME_PROTOCOLS = new Set(['cosmiq:', 'com.darrylgraham.revolution:']);
const CALENDAR_CALLBACK_ORIGIN_PARAM = 'calendar_callback_origin';

export interface DeepLinkData {
  type: 'task' | 'calendar_oauth' | 'calendar_oauth_callback' | 'auth_recovery' | 'join_epic' | 'journeys' | 'unknown';
  taskId?: string;
  provider?: CalendarOAuthProvider;
  status?: CalendarOAuthStatus;
  message?: string;
  path?: string;
  rawUrl: string;
}

const isNativeAuthRecoveryLink = (parsed: URL): boolean => {
  const isWebRecoveryLink = (
    ['https:', 'http:'].includes(parsed.protocol) &&
    HOSTED_APP_LINK_HOSTS.has(parsed.hostname) &&
    parsed.pathname === AUTH_RESET_PATH
  );

  const isSchemeRecoveryLink = (
    ['cosmiq:', 'com.darrylgraham.revolution:'].includes(parsed.protocol) &&
    (
      (parsed.hostname === 'auth' && parsed.pathname === '/reset-password') ||
      parsed.pathname === AUTH_RESET_PATH
    )
  );

  return (isWebRecoveryLink || isSchemeRecoveryLink) && parsed.hash.includes('type=recovery');
};

const isHostedCalendarOAuthCallbackLink = (parsed: URL): boolean => (
  ['https:', 'http:'].includes(parsed.protocol) &&
  HOSTED_APP_LINK_HOSTS.has(parsed.hostname) &&
  parsed.pathname === CALENDAR_OAUTH_CALLBACK_PATH
);

const isHostedAppLink = (parsed: URL): boolean =>
  ['https:', 'http:'].includes(parsed.protocol) && HOSTED_APP_LINK_HOSTS.has(parsed.hostname);

const readTaskId = (parsed: URL): string | null => {
  if (APP_SCHEME_PROTOCOLS.has(parsed.protocol) && ['task', 'tasks'].includes(parsed.hostname)) {
    return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (isHostedAppLink(parsed)) {
    return /^\/(?:task|tasks)\/([^/]+)\/?$/.exec(parsed.pathname)?.[1] ?? null;
  }

  return null;
};

const readJoinEpicPath = (parsed: URL): string | null => {
  if (APP_SCHEME_PROTOCOLS.has(parsed.protocol)) {
    if (parsed.hostname === 'join' && parsed.pathname.length > 1) {
      return `${JOIN_EPIC_PATH}${parsed.pathname}`;
    }

    const legacyMatch = parsed.hostname === 'epics'
      ? /^\/join\/([^/]+)\/?$/.exec(parsed.pathname)
      : null;
    if (legacyMatch) return `${JOIN_EPIC_PATH}/${legacyMatch[1]}`;
  }

  if (isHostedAppLink(parsed)) {
    const hostedMatch = /^\/(?:join|epics\/join|campaigns\/join)\/([^/]+)\/?$/.exec(parsed.pathname);
    if (hostedMatch) return `${JOIN_EPIC_PATH}/${hostedMatch[1]}`;
  }

  return null;
};

const isNativeJourneysLink = (parsed: URL): boolean => (
  APP_SCHEME_PROTOCOLS.has(parsed.protocol) &&
  parsed.hostname === 'journeys' &&
  (parsed.pathname === '' || parsed.pathname === '/' || parsed.pathname === '/plan')
);

const isHostedJourneysLink = (parsed: URL): boolean => (
  isHostedAppLink(parsed) &&
  ['/journeys', '/journeys/', '/journeys/plan', '/tasks', '/tasks/'].includes(parsed.pathname)
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
export const parseDeepLink = (url: string): DeepLinkData => {
  try {
    if (url.startsWith('cosmiq://calendar/oauth/callback')) {
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
    const taskId = readTaskId(parsed);
    if (taskId) {
      return { type: 'task', taskId, rawUrl: url };
    }

    if (isNativeJourneysLink(parsed) || isHostedJourneysLink(parsed)) {
      return {
        type: 'journeys',
        path: JOURNEYS_PATH,
        rawUrl: url,
      };
    }

    const joinEpicPath = readJoinEpicPath(parsed);
    if (joinEpicPath) {
      return {
        type: 'join_epic',
        path: joinEpicPath,
        rawUrl: url,
      };
    }

    if (isHostedCalendarOAuthCallbackLink(parsed)) {
      return {
        type: 'calendar_oauth_callback',
        path: buildHostedCalendarOAuthCallbackPath(parsed),
        rawUrl: url,
      };
    }

    if (isNativeAuthRecoveryLink(parsed)) {
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
