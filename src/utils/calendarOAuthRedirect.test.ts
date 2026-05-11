import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: capacitorMocks.isNativePlatform,
    getPlatform: capacitorMocks.getPlatform,
  },
}));

import {
  getCalendarOAuthRedirectUri,
  getCalendarOAuthSource,
  getOutlookNativeOAuthCallbackUrl,
} from './calendarOAuthRedirect';

describe('calendarOAuthRedirect', () => {
  beforeEach(() => {
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    capacitorMocks.getPlatform.mockReturnValue('web');
    vi.stubEnv('VITE_NATIVE_REDIRECT_BASE', 'https://app.cosmiq.quest');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project-ref.supabase.co/');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('routes native Outlook through the Supabase function callback', () => {
    expect(
      getCalendarOAuthRedirectUri({
        provider: 'outlook',
        source: 'native',
      }),
    ).toBe('https://project-ref.supabase.co/functions/v1/outlook-calendar-auth/callback');
  });

  it('keeps native Google on the app callback bridge', () => {
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    capacitorMocks.getPlatform.mockReturnValue('ios');

    expect(
      getCalendarOAuthRedirectUri({
        provider: 'google',
        source: 'native',
      }),
    ).toBe('https://app.cosmiq.quest/calendar/oauth/callback');
  });

  it('uses the current web origin for web Outlook', () => {
    window.history.replaceState({}, '', '/profile');

    expect(
      getCalendarOAuthRedirectUri({
        provider: 'outlook',
        source: 'web',
      }),
    ).toBe(`${window.location.origin}/calendar/oauth/callback`);
  });

  it('detects native versus web source', () => {
    expect(getCalendarOAuthSource()).toBe('web');

    capacitorMocks.isNativePlatform.mockReturnValue(true);
    expect(getCalendarOAuthSource()).toBe('native');
  });

  it('requires Supabase URL before building the Outlook native callback', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');

    expect(() => getOutlookNativeOAuthCallbackUrl()).toThrow(
      'Missing VITE_SUPABASE_URL for Outlook native calendar redirects',
    );
  });
});
