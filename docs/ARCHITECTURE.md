# Architecture

## Stack

- **Web**: React 18 + TypeScript + Vite + Tailwind CSS, in `apps/web/`
- **Backend**: Supabase (PostgreSQL + Auth + RLS), schema in `supabase/migrations/`
- **Deploy**: static build to Netlify (`apps/web/dist`)

## Structure

```
apps/web/src/
  main.tsx                     Entry point
  App.tsx                      Routes (auth + protected shell)
  lib/supabase.ts              Supabase client from env vars; null when unconfigured
  components/
    ProtectedRoute.tsx         Redirects to /auth when there is no session
    ui/                        Design system: PageShell, SectionCard, ActionLink, BackLink
  features/
    auth/                      AuthContext (session state), AuthPage, PasswordResetCallback, ProfilePage
```

## Auth flow

1. `AuthProvider` loads the session on mount and subscribes to auth state changes
2. `ProtectedRoute` gates everything under `/app` and `/profile`
3. Sign-up auto-creates a `profiles` row via the `handle_new_user` trigger (migration 003)
4. Password reset uses the standard Supabase recovery flow at `/auth/callback`

## Repository pattern (recommended for new features)

Each feature gets:

- `<name>Repository.ts` — interface + a mock implementation (in-memory, used by unit tests and as fallback when Supabase is unconfigured)
- `supabase<Name>Repository.ts` — production implementation; every query filters by `user_id = auth user id`; RLS is the security boundary
- `<Page>.test.tsx` — component tests against the mock
- `<name>.integration.test.ts` — live tests against a real Supabase project (skips when env vars are absent)

## Database access rules

- New table → migration + GRANT line in `002_table_grants.sql` + RLS policies
- Never expose service-role credentials client-side
- RLS policies are the security boundary; client filters are defense-in-depth