import { toUserFacingFunctionError, type ParsedFunctionInvokeError } from '@/utils/supabaseFunctionErrors';

type CalendarOAuthProvider = 'google' | 'outlook';

function providerLabel(provider: CalendarOAuthProvider): string {
  return provider === 'google' ? 'Google' : 'Outlook';
}

function combinedErrorText(parsed: ParsedFunctionInvokeError): string {
  return [
    parsed.backendMessage,
    parsed.details,
    parsed.upstreamError,
    parsed.message,
    parsed.responsePayload?.message,
    parsed.responsePayload?.error,
    parsed.responsePayload?.details,
    parsed.responsePayload?.upstreamError,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function isProviderConfigError(text: string): boolean {
  return (
    text.includes('integration not configured') ||
    text.includes('invalid_client') ||
    text.includes('client_assertion') ||
    text.includes('client_secret') ||
    text.includes('client secret') ||
    text.includes('client assertion') ||
    text.includes('aadsts7000215') ||
    text.includes('aadsts7000218')
  );
}

function isOAuthClientTypeError(text: string): boolean {
  return (
    text.includes('aadsts9002325') ||
    text.includes('aadsts9002326') ||
    text.includes('proof key for code exchange') ||
    text.includes('pkce') ||
    text.includes('single-page application') ||
    text.includes('cross-origin token redemption') ||
    text.includes('public client')
  );
}

function isRedirectUriError(text: string): boolean {
  return (
    text.includes('redirect_uri') ||
    text.includes('redirect uri') ||
    text.includes('reply address') ||
    text.includes('aadsts50011')
  );
}

function isExpiredOrReusedCodeError(text: string): boolean {
  return (
    text.includes('authorization code is invalid') ||
    text.includes('authorization code has expired') ||
    text.includes('code has expired') ||
    text.includes('code was already redeemed') ||
    text.includes('code has already been redeemed') ||
    text.includes('aadsts54005') ||
    text.includes('aadsts70000')
  );
}

function isScopeError(text: string): boolean {
  return (
    text.includes('invalid_scope') ||
    text.includes('scope is not valid') ||
    text.includes('permission') ||
    text.includes('consent')
  );
}

function extractOAuthDiagnosticCode(text: string): string | null {
  const aadstsMatch = text.match(/\bAADSTS\d+\b/i);
  if (aadstsMatch?.[0]) {
    return aadstsMatch[0].toUpperCase();
  }

  const oauthErrorMatch = text.match(/"error"\s*:\s*"([^"]+)"/i);
  return oauthErrorMatch?.[1]?.toUpperCase() ?? null;
}

export function toUserFacingCalendarOAuthError(
  provider: CalendarOAuthProvider,
  parsed: ParsedFunctionInvokeError,
): string {
  const text = combinedErrorText(parsed);
  const label = providerLabel(provider);
  const diagnosticCode = extractOAuthDiagnosticCode(text);

  if (text.includes('invalid or expired oauth state')) {
    return 'Calendar connection expired. Please try again.';
  }

  if (provider === 'outlook' && isOAuthClientTypeError(text)) {
    return 'Outlook rejected this OAuth client type. Register the callback as a Web redirect URI in Microsoft Entra and use the matching client secret.';
  }

  if (isProviderConfigError(text)) {
    return diagnosticCode
      ? `${label} Calendar is not configured correctly on the server yet (${diagnosticCode}). Please contact support.`
      : `${label} Calendar is not configured correctly on the server yet. Please contact support.`;
  }

  if (isRedirectUriError(text)) {
    return `${label} rejected this callback URI. Please verify the calendar redirect settings for this build.`;
  }

  if (isExpiredOrReusedCodeError(text)) {
    return 'Calendar connection expired or was already used. Please try connecting again.';
  }

  if (isScopeError(text)) {
    return `${label} rejected the requested calendar permissions. Please verify the OAuth scopes for this build.`;
  }

  if (text.includes('invalid_grant')) {
    return 'The calendar provider rejected this authorization code. Please try connecting again.';
  }

  return toUserFacingFunctionError(parsed, { action: 'connect your calendar' });
}
