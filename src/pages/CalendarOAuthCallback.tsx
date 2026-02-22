import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { parseFunctionInvokeError, toUserFacingFunctionError } from '@/utils/supabaseFunctionErrors';
import { supabase } from '@/integrations/supabase/client';
import type { CalendarProvider } from '@/hooks/useCalendarIntegrations';

type OAuthProvider = Exclude<CalendarProvider, 'apple'>;
type CallbackStatus = 'success' | 'error';

const isOAuthProvider = (value: string | null): value is OAuthProvider =>
  value === 'google' || value === 'outlook';

const providerLabel = (provider: OAuthProvider): string =>
  provider === 'google' ? 'Google' : 'Outlook';

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

const getProviderConfigErrorMessage = (
  provider: OAuthProvider,
  parsed: Awaited<ReturnType<typeof parseFunctionInvokeError>>,
): string | null => {
  const backend = `${parsed.backendMessage ?? ''} ${parsed.message ?? ''}`.toLowerCase();
  if (!backend.includes('integration not configured')) {
    return null;
  }

  return `${providerLabel(provider)} Calendar is not configured on the server yet. Please contact support.`;
};

export default function CalendarOAuthCallback() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const provider = params.get('calendar_provider');
      const source = params.get('calendar_source') === 'native' ? 'native' : 'web';
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const code = params.get('code');
      const state = params.get('state');

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

      if (!isOAuthProvider(provider)) {
        finish({
          provider: 'google',
          status: 'error',
          message: 'Unsupported calendar provider.',
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

      const redirectUri = `${window.location.origin}${window.location.pathname}?calendar_provider=${provider}&calendar_source=${source}`;

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
        const configMessage = getProviderConfigErrorMessage(provider, parsed);
        finish({
          provider,
          status: 'error',
          message: configMessage ?? toUserFacingFunctionError(parsed, { action: 'connect your calendar' }),
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
