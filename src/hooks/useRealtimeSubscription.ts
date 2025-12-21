/**
 * Realtime Reconnection Utilities
 * Provides exponential backoff reconnection for Supabase Realtime channels
 */

import { logger } from "@/utils/logger";

const log = logger.scope('Realtime');

/**
 * Creates a reconnection handler with exponential backoff for Supabase Realtime channels.
 * 
 * Usage:
 * ```ts
 * const reconnection = createReconnectionHandler('my-channel', () => subscribeToChannel());
 * 
 * const channel = supabase
 *   .channel('my-channel')
 *   .on('postgres_changes', {...}, handler)
 *   .subscribe((status, err) => {
 *     reconnection.handleStatus(status, err);
 *   });
 * 
 * // In cleanup:
 * reconnection.cleanup();
 * ```
 */
export function createReconnectionHandler(
  channelName: string,
  onReconnect: () => void,
  maxAttempts = 5
) {
  let attempts = 0;
  let timeout: NodeJS.Timeout | null = null;

  const handleStatus = (status: string, err?: Error | null) => {
    if (status === 'SUBSCRIBED') {
      attempts = 0;
      log.debug(`Subscribed to ${channelName}`);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      log.warn(`Channel error for ${channelName}`, { status, error: err?.message });
      
      if (attempts < maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
        log.debug(`Reconnecting ${channelName} in ${delay}ms (attempt ${attempts + 1}/${maxAttempts})`);
        
        timeout = setTimeout(() => {
          attempts += 1;
          onReconnect();
        }, delay);
      } else {
        log.error(`Max reconnection attempts reached for ${channelName}`);
      }
    }
  };

  const cleanup = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const reset = () => {
    attempts = 0;
    cleanup();
  };

  return { handleStatus, cleanup, reset };
}
