import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { toUserFacingCalendarOAuthError } from '@/utils/calendarOAuthErrors';
import { parseFunctionInvokeError } from '@/utils/supabaseFunctionErrors';
import { supabase } from '@/integrations/supabase/client';
import type { CalendarProvider } from '@/hooks/useCalendarIntegrations';

type OAuthProvider = Exclude<CalendarProvider, 'apple'>;
type CallbackStatus = 'success' | 'error';
type OAuthSource = 'web' | 'native';

interface OAuthStateHint {
  provider: OAuthProvider;
  source: OAuthSource;
}

const CALLBACK_ORIGIN_PARAM = 'calendar_callback_origin';

const isOAuthProvider = (value: string | null): value is OAuthProvider =>
  value === 'google' || value === 'outlook';

const isOAuthSource = (value: unknown): value is OAuthSource =>
  value === 'web' || value === 'native';

const providerLabel = (provider: OAuthProvider): string =>
  provider === 'google' ? 'Google' : 'Outlook';

const decodeBase64Url = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return window.atob(padded);
};

export const getCalendarOAuthStateHint = (state: string | null | undefined): OAuthStateHint | null => {
  if (!state) return null;

  const [rawPayload] = state.split('.');
  if (!rawPayload) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(rawPayload)) as Record<string, unknown>;
    const provider = typeof payload.provider === 'string' && isOAuthProvider(payload.provider)
      ? payload.provider
      : null;

    if (!provider) return null;

    return {
      provider,
      source: isOAuthSource(payload.source) ? payload.source : 'web',
    };
  } catch {
    return null;
  }
};

const getLegacyRedirectUri = (args: {
  provider: OAuthProvider;
  source: OAuthSource;
  origin: string;
  pathname: string;
}): string => `${args.origin}${args.pathname}?calendar_provider=${args.provider}&calendar_source=${args.source}`;

const getCallbackRedirectOrigin = (params: URLSearchParams, fallbackOrigin: string): string => {
  const rawOrigin = params.get(CALLBACK_ORIGIN_PARAM);
  if (!rawOrigin) return fallbackOrigin;

  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return fallbackOrigin;
    }
    return parsed.origin;
  } catch {
    return fallbackOrigin;
  }
};

export const getCalendarOAuthCallbackContext = (args: {
  search: string;
  origin: string;
  pathname: string;
}): {
  provider: OAuthProvider | null;
  source: OAuthSource;
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
  redirectUri: string;
} => {
  const params = new URLSearchParams(args.search);
  const redirectOrigin = getCallbackRedirectOrigin(params, args.origin);
  const legacyProvider = params.get('calendar_provider');
  const legacySource = params.get('calendar_source');
  const state = params.get('state');
  const stateHint = getCalendarOAuthStateHint(state);
  const provider = isOAuthProvider(legacyProvider)
    ? legacyProvider
    : stateHint?.provider ?? null;
  const source = isOAuthSource(legacySource)
    ? legacySource
    : stateHint?.source ?? 'web';
  const redirectUri = provider && isOAuthProvider(legacyProvider)
    ? getLegacyRedirectUri({
      provider,
      source,
      origin: redirectOrigin,
      pathname: args.pathname,
    })
    : `${redirectOrigin}${args.pathname}`;

  return {
    provider,
    source,
    code: params.get('code'),
    state,
    error: params.get('error'),
    errorDescription: params.get('error_description'),
    redirectUri,
  };
};

const buildProfileRedirect = (args: {
  provider: OAuthProvider;
  status: CallbackStatus;
  message?: string;
}): string => {
  const params = new URLSearchParams({
    calendar_oauth_provider: args.provider,
    calendar_oauth_status: args.status,
  });

  if (args.message) {
    params.set('calendar_oauth_message', args.message);
  }

  return `/profile?${params.toString()}`;
};

const buildNativeRedirect = (args: {
  provider: OAuthProvider;
  status: CallbackStatus;
  message?: string;
}): string => {
  const params = new URLSearchParams({
    provider: args.provider,
    status: args.status,
  });

  if (args.message) {
    params.set('message', args.message);
  }

  return `cosmiq://calendar/oauth/callback?${params.toString()}`;
};

export default function CalendarOAuthCallback() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const {
        provider,
        source,
        error,
        errorDescription,
        code,
        state,
        redirectUri,
      } = getCalendarOAuthCallbackContext({
        search: window.location.search,
        origin: window.location.origin,
        pathname: window.location.pathname,
      });

      const finish = (payload: {
        provider: OAuthProvider;
        status: CallbackStatus;
        message?: string;
      }) => {
        if (cancelled) return;

        const profileRedirect = buildProfileRedirect(payload);
        if (source === 'native') {
          window.location.replace(buildNativeRedirect(payload));
          window.setTimeout(() => {
            if (!cancelled) {
              window.location.replace(profileRedirect);
            }
          }, 2000);
          return;
        }

        window.location.replace(profileRedirect);
      };

      if (!provider) {
        finish({
          provider: 'google',
          status: 'error',
          message: 'Missing or invalid calendar connection state. Please try connecting again.',
        });
        return;
      }

      if (error) {
        finish({
          provider,
          status: 'error',
          message: errorDescription || 'Calendar connection was cancelled.',
        });
        return;
      }

      if (!code) {
        finish({
          provider,
          status: 'error',
          message: 'Missing authorization code from calendar provider.',
        });
        return;
      }

      const { error: exchangeError } = await supabase.functions.invoke(`${provider}-calendar-auth`, {
        body: {
          action: 'exchangeCode',
          code,
          redirectUri,
          state: state ?? undefined,
        },
      });

      if (exchangeError) {
        const parsed = await parseFunctionInvokeError(exchangeError);
        finish({
          provider,
          status: 'error',
          message: toUserFacingCalendarOAuthError(provider, parsed),
        });
        return;
      }

      finish({
        provider,
        status: 'success',
        message: `${providerLabel(provider)} Calendar connected successfully.`,
      });
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Completing calendar connection...
      </div>
    </div>
  );
}
