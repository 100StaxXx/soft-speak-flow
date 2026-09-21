# Google/Outlook calendar browser launch recovery

Included in the build 361 release; see `2026-09-20-release-361.md` for delivery status.

## Evidence

The screenshots show `Failed to start connection / Unable to display URL`. Both providers use CalendarIntegrationsSettings → Browser.open after parseCalendarOAuthUrl has validated an HTTPS URL. In installed @capacitor/browser iOS source, this exact error comes from Browser.prepare rejecting either a non-HTTP(S) URL or an already-retained Safari controller. With the validated HTTPS path, a retained controller is the supported explanation; no device runtime trace was collected to establish which earlier dismissal left it behind. This failure happens before provider login is displayed, not during token exchange.

## Scoped repair

- Calendar launches now retry once only for the exact iOS `Unable to display URL` error: await Browser.close, then open the same validated, signed authorization URL. No new OAuth request, URL logging, session clearing or authentication changes.
- A concurrent callback's `No active window to close!` is benign; other close errors stop recovery. A second open failure shows a readable recovery message rather than looping.
- A synchronous in-flight guard and disabled connection buttons prevent overlapping Google/Outlook/Apple starts while the current launch is pending.
- Web navigation, backend OAuth configuration, callback routes, tokens and current connections are unchanged. No shared function was deployed.

## Verification

39 focused browser/settings/URL/redirect tests passed. Typecheck, changed-file lint and production build checks were run. Tests exercise both provider URLs, retained-controller recovery, one authorization request, one bounded retry, callback-close races, malformed URLs and overlapping launches.

After shipping, verify on iPhone: open/cancel/reopen each provider, switch providers, background/return, and finish real authorization. Local mocked recovery does not prove end-to-end Google or Microsoft consent, callback and synchronization.

Reference: https://capacitorjs.com/docs/apis/browser. Failure condition verified against the installed iOS Browser.swift and BrowserPlugin.swift, not inferred from generic documentation alone.
