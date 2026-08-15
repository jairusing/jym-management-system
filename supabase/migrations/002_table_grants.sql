-- Grant table-level DML privileges to Supabase roles.
-- The web client authenticates via the anon key (role `anon`/`authenticated`).
-- Without these grants, REST queries fail with "permission denied for table".
-- RLS policies (from 001_initial_schema.sql) remain the row-level security boundary.
-- Add one GRANT line per new table you create in later migrations.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO anon, authenticated, service_role;