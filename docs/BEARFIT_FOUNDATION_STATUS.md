# BearFit foundation stabilization

Implemented on 2026-09-02:

- Added Supabase migrations for `members`, `profiles`, `payments`, and `session_logs`.
- Added RLS and role-aware staff/admin access.
- Added automatic member/profile creation after Supabase Auth signup.
- Added `staff_qr_checkin` RPC with server-side role enforcement.
- Added Next.js `proxy.ts` session refresh wiring.
- Fixed the welcome/onboarding redirect loop.
- Standardized login/signup on `/api/auth/signin` and `/api/auth/signup`.
- Added an `/auth/confirm` token callback for SSR email confirmation.
- Removed the public service-key `/api/init-db` route.
- Fixed stale `/dashboard` links and Next.js async route params.
- Removed unused duplicate Supabase/auth code.
- Added regression tests under `tests/`.

## Required Vercel environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Supabase email confirmation

If email confirmation is enabled, configure the Confirm signup email template to use:

`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

Set the Supabase Site URL to the production Vercel/custom domain.

## Remaining dependency task

The source currently pins Next.js 16.1.3. The execution environment used for this stabilization cannot reach npm, so the lockfile could not be safely regenerated for a framework upgrade. Upgrade Next.js and `eslint-config-next` together in a networked environment and regenerate `pnpm-lock.yaml` before relying on the security-version upgrade.
