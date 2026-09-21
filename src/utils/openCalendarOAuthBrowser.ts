import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { parseCalendarOAuthUrl } from './calendarOAuthUrl';

const messageOf = (error: unknown) => error instanceof Error ? error.message :
  typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : '';
const unavailable = () => new Error('The calendar sign-in window could not open. Close and reopen Cosmiq, then try connecting again. Your Cosmiq sign-in and existing calendar connections are unchanged.');

/** Recover only iOS Browser.prepare's retained-controller failure, not OAuth errors.
 * Reuse the same signed URL; never create a second authorization request or log it.
 */
export async function openCalendarOAuthBrowser(payload: unknown): Promise<void> {
  const url = parseCalendarOAuthUrl(payload);
  try {
    await Browser.open({ url });
    return;
  } catch (error) {
    if (Capacitor.getPlatform() !== 'ios' || !/^Unable to display URL$/i.test(messageOf(error).trim())) {
      throw unavailable();
    }
  }
  try {
    await Browser.close();
  } catch (error) {
    // A callback may have closed the retained controller between open and close.
    if (!/^No active window to close!?$/i.test(messageOf(error).trim())) throw unavailable();
  }
  try {
    await Browser.open({ url });
  } catch {
    throw unavailable();
  }
}
