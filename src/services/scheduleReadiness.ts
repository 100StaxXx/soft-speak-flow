import { getActiveQueuedActions, isOfflineDBTemporarilyUnavailable } from '@/utils/offlineStorage';
import { hasPlannerRemoteSyncLock } from '@/utils/plannerSync';
import type { ScheduleReadIssue } from './scheduleReadMessage';

/** Read-only availability needs stable schedule data, not an empty app-wide queue. */
export async function scheduleReadiness(userId: string): Promise<ScheduleReadIssue | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline';
  if (isOfflineDBTemporarilyUnavailable()) return 'device-storage';
  if (hasPlannerRemoteSyncLock(userId)) return 'schedule-updating';
  const actions = await getActiveQueuedActions(userId);
  if (isOfflineDBTemporarilyUnavailable()) return 'device-storage';
  // Unknown actions remain conservative; only known non-schedule writes are ignored.
  if (actions.some(action => !['MENTOR_FEEDBACK', 'SUPPORT_REPORT'].includes(action.action_kind))) return 'local-sync';
  if (hasPlannerRemoteSyncLock(userId)) return 'schedule-updating';
  return null;
}
