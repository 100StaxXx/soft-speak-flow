import { describe, expect, it } from 'vitest';
import { toUserFacingCalendarOAuthError } from './calendarOAuthErrors';
import type { ParsedFunctionInvokeError } from './supabaseFunctionErrors';

const baseParsed: ParsedFunctionInvokeError = {
  category: 'http',
  isOffline: false,
  status: 400,
  backendMessage: 'Failed to exchange authorization code',
};

describe('calendarOAuthErrors', () => {
  it('maps Microsoft redirect mismatch details to callback configuration guidance', () => {
    expect(
      toUserFacingCalendarOAuthError('outlook', {
        ...baseParsed,
        details: '{"error":"invalid_grant","error_description":"AADSTS50011: redirect_uri mismatch"}',
      }),
    ).toBe('Outlook rejected this callback URI. Please verify the calendar redirect settings for this build.');
  });

  it('maps Microsoft client-type/PKCE errors to Entra redirect platform guidance', () => {
    expect(
      toUserFacingCalendarOAuthError('outlook', {
        ...baseParsed,
        details:
          '{"error":"invalid_request","error_description":"AADSTS9002325: Proof Key for Code Exchange is required for cross-origin authorization code redemption."}',
      }),
    ).toBe(
      'Outlook rejected this OAuth client type. Register the callback as a Web redirect URI in Microsoft Entra and use the matching client secret.',
    );
  });

  it('maps reused or expired authorization codes to retry guidance', () => {
    expect(
      toUserFacingCalendarOAuthError('google', {
        ...baseParsed,
        details: '{"error":"invalid_grant","error_description":"Authorization code has expired"}',
      }),
    ).toBe('Calendar connection expired or was already used. Please try connecting again.');
  });

  it('falls back to a provider code rejection message for unclassified invalid grants', () => {
    expect(
      toUserFacingCalendarOAuthError('outlook', {
        ...baseParsed,
        details: '{"error":"invalid_grant"}',
      }),
    ).toBe('The calendar provider rejected this authorization code. Please try connecting again.');
  });
});
