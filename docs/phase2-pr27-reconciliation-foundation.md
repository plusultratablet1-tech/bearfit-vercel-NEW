# BearFit Phase 2 PR #27 — safe reconciliation foundation

## Stage 1 — current production dashboard verification
A booked visit now uses its stored booking branch rather than the member's editable current branch. Visits with unresolved or member-mismatched booking links are excluded from individual branch totals and shown as an All-branches review exception. The extra booking-ID lookup is bounded to 200. If the lookup fails or hits a query cap, affected attendance metrics are unavailable, not a misleading zero.

Manual walk-in logs do not have a recorded visit branch, and payments currently lack a branch-at-payment snapshot. The UI and CSV disclose that historical payment attribution may change when a member transfers. This PR does not rewrite source transactions, infer historical cash settlement, or validate physical attendance.

## Stage 2 schema (NOT YET APPLIED)
The additive migration `20261014170000_reconciliation_case_foundation.sql` creates two empty tables:
- `reconciliation_cases` stores source identity, branch snapshot, Philippine-local business date, review reason and status.
- `reconciliation_case_events` stores actor, transition and append-only history.

Both are Admin-only RLS SELECT. There are no authenticated INSERT/UPDATE/DELETE grants, no client writes, no data backfill, no trigger on source data, and no write RPCs. Later stages must add transactionally controlled Admin RPCs with idempotency, source verification, unique receipt matching and auditable transitions.

## Release gates
1. Full repository regression suite and Next.js/TypeScript preview build pass.
2. Review Admin, staff and unauthenticated access; branch comparison, errors, CSV disclaimers and empty data.
3. Before schema rollout, use a **separate Supabase staging/preview branch**; run database auth/RLS allow/deny testing for anon, member, staff and Admin, and inspect security advisories.
4. Leave production Supabase unchanged until the schema has been reviewed and a separate migration rollout is approved.
5. Preserve existing sessions, package credits, guest rules, payment history, coach rates, payroll and prior audit events.

No daily closing, bank proof verification, coach payment approval, or member session adjustment is introduced by this PR.
