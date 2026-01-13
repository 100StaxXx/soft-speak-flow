import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { logger } from './logger';

export interface DeepLinkData {
  type: 'task' | 'unknown';
  taskId?: string;
  rawUrl: string;
}

/**
 * Parse a cosmiq:// deep link URL
 */
export const parseDeepLink = (url: string): DeepLinkData => {
  try {
    // cosmiq://task/{taskId}
    if (url.startsWith('cosmiq://task/')) {
      const taskId = url.replace('cosmiq://task/', '').split('?')[0];
      return { type: 'task', taskId, rawUrl: url };
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
