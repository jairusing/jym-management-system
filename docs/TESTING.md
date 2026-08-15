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
  - `JYM_TEST_EMAIL`, `JYM_TEST_PASSWORD` — an existing test account
  - `JYM_TEST_EMAIL_B`, `JYM_TEST_PASSWORD_B` — a second account for isolation checks

A mocked test does NOT prove real RLS/schema/auth/connectivity — run the live suite before claiming a backend works.

## What to test

- Page flows against the mock (render → interact → assert)
- Repository round-trips live (create → read → update → delete)
- RLS isolation: anon and a second user must read 0 rows of the owner's data