# Production Security Checklist

Repo-grounded audit date: `2026-03-28`

## Checklist

| Control | Status | Repo evidence |
| --- | --- | --- |
| Auth configuration | NEEDS REVIEW | Edge functions that require real user sessions now use `verify_jwt = true` in `supabase/config.toml`, but hosted auth settings like redirect allowlists, email confirmation, leaked-password protection, and MFA still need dashboard review. |
| RLS / security rules | PASS | User-facing tables and storage policies already have RLS coverage, and the security SQL suite exercises cross-user and privileged-write protections. |
| Protected secrets | PASS | `.env` and `.env.*` are ignored in `.gitignore`, tracked local secret files were removed from git, `.env.example` is the only tracked template, and repo docs point production secrets to Supabase project secrets or GitHub Actions secrets. |
| Backend-only sensitive operations | PASS | `generate-evening-response` and `generate-weekly-recap` derive scope from authenticated users, `transcribe-audio` requires an internal secret, and `sync-daily-pep-talk-transcript` is internal-only. |
| Rate limiting | PASS | Browser-invoked AI/image endpoints use per-user limits in `supabase/functions/_shared/rateLimiter.ts`, and the shared limiter now fails closed with a `503` when quota storage is unavailable. |
| Storage permissions | PASS | `quest-attachments` is forced private by migration, uploads remain folder-scoped, and the client now generates signed URLs from `file_path` instead of trusting stored public URLs. |
| Logging and alerting | NEEDS REVIEW | The repo logs security audit events and supports Sentry wiring, but alert routing, production DSNs, and on-call notifications are console-managed. |
| Budget controls | NEEDS REVIEW | Cost guardrail code exists, but OpenAI and Supabase spend caps or alert thresholds still need live dashboard confirmation. |
| Webhook verification | PASS | `paypal-webhook` fails closed without `PAYPAL_WEBHOOK_ID` outside local environments and writes verification failures to `security_audit_log`. |
| Least-privilege service accounts | NEEDS REVIEW | Code assumes scoped secrets and internal keys, but provider app scopes and secret permissions must still be reviewed in Supabase, Apple, Google, PayPal, Resend, and GitHub. |
| Incident response basics | PASS | `docs/security-incident-response.md` now records containment, evidence capture, secret rotation, rollback, and escalation basics for production incidents. |

## Manual Console Changes

- Rotate the Apple Sign-In private key and any secret that ever lived in tracked env files if the repo or its backups were shared.
- Set or verify Supabase project secrets for `PAYPAL_WEBHOOK_ID`, `INTERNAL_FUNCTION_SECRET`, `OPENAI_API_KEY`, `RESEND_API_KEY`, Apple auth material, and PayPal credentials.
- Review Supabase Auth settings for the exact site URL, redirect allowlist, email confirmation, leaked-password protection, and MFA on admin accounts.
- Configure the production Sentry DSN and alert recipients.
- Configure OpenAI and Supabase budget alerts or hard spend limits.
- Review Google, Apple, PayPal, Resend, and GitHub service account scopes for least privilege.
- If `.env` or `.env.save` were ever pushed to a remote, coordinate history cleanup separately from this branch work.

## Notes

- This checklist is intentionally repo-grounded. Any control enforced only in hosted dashboards remains `NEEDS REVIEW` until it is checked live.
- Public generated-media buckets were left unchanged in this pass. The storage hardening here is limited to direct user uploads in `quest-attachments`.
