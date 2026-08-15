# Testing

Runner: Vitest. Commands (from `apps/web`): `npm test` (unit), `npm run lint`, `npm run build` (tsc + vite).

## Unit tests

- Component tests carry the pragma `// @vitest-environment jsdom`
- Pages are tested against mock repositories with React Testing Library (`fireEvent`, `screen`)
- No network access; Supabase is mocked (`vi.mock('../../lib/supabase')`)

## Live integration tests (optional, for verified backends)

- Carry the pragma `// @vitest-environment node`
- Run against a real Supabase project; **skip gracefully when env vars are absent** so `npm test` stays green for everyone
- Env vars (set in the shell, not committed):
  - `JYM_TEST_EMAIL`, `JYM_TEST_PASSWORD` — an existing test account whose `profiles.role` is `owner` or `staff` (all writes are RLS-restricted to staff/owner)
  - `JYM_TEST_EMAIL_B`, `JYM_TEST_PASSWORD_B` — a second account for isolation checks

A mocked test does NOT prove real RLS/schema/auth/connectivity — run the live suite before claiming a backend works.

### Live suite evidence

One integration suite per repository (7 total):

| Suite | Proves |
|---|---|
| `supabaseMemberRepository` | member insert/list/update/toggle/delete through real RLS |
| `supabaseCheckInRepository` | check-in insert with `processed_by`, today-filtered list, member-name join, cascade delete |
| `supabaseClassRepository` | class CRUD, session materialization copying capacity/time from class, cascade delete |
| `supabaseBookingRepository` | booking insert (unique session+member), member-name join, cancel → status flip |
| `supabaseInvoiceRepository` | invoice insert with `INV-` numbering, member-name join |
| `supabasePaymentRepository` | payment insert with `processed_by`, invoice auto-marked paid, joins |
| `supabaseDashboardRepository` | aggregated attendance/revenue counts reflect fresh rows |

Run everything with the env vars set:

```sh
JYM_TEST_EMAIL=... JYM_TEST_PASSWORD=... npm test
```

Record each verified run here (date, project, suite count, result):

| Date | Project | Result |
|---|---|---|
| 2026-08-16 | jms (osujvqcsomfawxxrhjty) | 7/7 live suites passed (68/68 tests; 3 consecutive runs) |

### Flake resilience

Supabase's auth fleet intermittently rejects freshly issued access tokens under parallel load (GoTrue "JWT issued at future" / "Auth session missing!", platform clock skew). The live suites handle this two ways:

- `beforeEach` heals the session: if `getUser()` errors, it signs out and signs in again (fresh token).
- `test.retry: 1` in `vite.config.ts` re-runs a failed test once (unit tests are deterministic, so retries only ever fire for live flakes).

The repositories avoid `auth.getUser()` (server-validated, network round-trip) and use `auth.getSession()` instead when recording `processed_by`, so check-ins/payments work even during skew windows.

## What to test

- Page flows against the mock (render → interact → assert)
- Repository round-trips live (create → read → update → delete)
- RLS isolation: anon and a second user must read 0 rows of the owner's data