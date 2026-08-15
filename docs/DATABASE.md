# Database

Backend: Supabase (PostgreSQL). All schema changes are migrations in `supabase/migrations/`, applied with `supabase db push`.

## Tables

### profiles

One row per auth user, auto-created by the `handle_new_user` trigger (migration 003).

| column     | type      | notes                        |
|------------|-----------|------------------------------|
| id         | UUID      | PK, matches auth.users.id    |
| name       | TEXT      | required                     |
| email      | TEXT      |                              |
| avatar_url | TEXT      |                              |
| created_at | TIMESTAMPTZ | default now()              |
| updated_at | TIMESTAMPTZ | default now()              |

## RLS pattern (per table)

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. Policies: select/insert/update scoped to `auth.uid()`, delete usually `USING (false)`
3. GRANT line added to `002_table_grants.sql` — without it, REST queries fail with "permission denied for table"

## Adding a table

1. `supabase/migrations/NNN_name.sql` — `CREATE TABLE`, RLS enable, policies, indexes
2. Add GRANT to `002_table_grants.sql`
3. `supabase db push` (requires explicit user approval before touching a live project)
4. Backfill migrations: 004 shows the pattern for healing missing rows

## Environment

`apps/web/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key is public; RLS is the security boundary). Never commit real values.