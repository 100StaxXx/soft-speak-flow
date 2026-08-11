import { describe, expect, it } from 'vitest';
import { parseCalendarOAuthUrl } from './calendarOAuthUrl';

describe('parseCalendarOAuthUrl', () => {
  it.each([
    { url: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=cosmiq' },
    { auth_url: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' },
    { authUrl: 'https://accounts.google.com/o/oauth2/v2/auth' },
    JSON.stringify({ url: 'https://accounts.google.com/o/oauth2/v2/auth' }),
    'https://accounts.google.com/o/oauth2/v2/auth',
  ])('accepts a secure provider URL from supported response shapes', (payload) => {
    expect(parseCalendarOAuthUrl(payload)).toMatch(/^https:\/\//);
  });

  it.each([
    undefined,
    null,
    {},
    { url: '' },
    { url: 'not a url' },
    { url: 'cosmiq://calendar/oauth/callback' },
    { url: 'http://accounts.google.com/o/oauth2/v2/auth' },
  ])('rejects a missing, malformed, or insecure provider URL', (payload) => {
    expect(() => parseCalendarOAuthUrl(payload)).toThrow(/calendar|sign-in link/i);
  });
});
