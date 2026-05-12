import { Capacitor } from '@capacitor/core';
import { getRedirectUrlWithPath } from '@/utils/redirectUrl';

type OAuthCalendarProvider = 'google' | 'outlook';
type OAuthCalendarSource = 'web' | 'native';

const CALENDAR_CALLBACK_PATH = '/calendar/oauth/callback';
const GOOGLE_NATIVE_CALLBACK_PATH = '/functions/v1/google-calendar-auth/callback';
const OUTLOOK_NATIVE_CALLBACK_PATH = '/functions/v1/outlook-calendar-auth/callback';

export const getCalendarOAuthSource = (): OAuthCalendarSource =>
  Capacitor.isNativePlatform() ? 'native' : 'web';

export const getOutlookNativeOAuthCallbackUrl = (
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL,
): string => {
  const base = supabaseUrl?.trim();
  if (!base) {
    throw new Error('Missing VITE_SUPABASE_URL for Outlook native calendar redirects');
  }

  return `${base.replace(/\/$/, '')}${OUTLOOK_NATIVE_CALLBACK_PATH}`;
};

export const getGoogleNativeOAuthCallbackUrl = (
  supabaseUrl = import.meta.env.VITE_SUPABASE_URL,
): string => {
  const base = supabaseUrl?.trim();
  if (!base) {
    throw new Error('Missing VITE_SUPABASE_URL for Google native calendar redirects');
  }

  return `${base.replace(/\/$/, '')}${GOOGLE_NATIVE_CALLBACK_PATH}`;
};

export const getCalendarOAuthRedirectUri = ({
  provider,
  source,
}: {
  provider: OAuthCalendarProvider;
  source: OAuthCalendarSource;
}): string => {
  if (provider === 'google' && source === 'native') {
    return getGoogleNativeOAuthCallbackUrl();
  }

  if (provider === 'outlook' && source === 'native') {
    return getOutlookNativeOAuthCallbackUrl();
  }

  return getRedirectUrlWithPath(CALENDAR_CALLBACK_PATH);
};
