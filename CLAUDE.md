# Web Starter — Agent Instructions

These instructions are authoritative for AI coding agents working in this repository.

## Source of truth / anti-hallucination

- The actual repository files, database schema/migrations, config, and terminal/test output are authoritative.
- Never assume files, functions, components, types, database tables/columns/constraints/RLS, env vars, package scripts, dependencies, or existing behavior exist.
- Label uncertain information explicitly: VERIFIED / INFERENCE / RECOMMENDATION / UNKNOWN.

## Verify before changing code

- Read relevant docs and existing files, search usages, inspect tests and package scripts before editing.
- For Supabase/database work, inspect actual migrations/schema/RLS before writing db code.
- Never query an unverified column. Never change schema, migrations, RLS, constraints, or RPCs without explicit user approval.
- Do not expose Supabase service-role credentials to clients. RLS is the security boundary.

## Conventions

- New feature = new folder under `apps/web/src/features/<name>/` with: repository interface, Supabase implementation, page component, unit tests.
- New table = new numbered migration + GRANT line in `002_table_grants.sql` + RLS policies (profiles migration is the reference pattern).
- Tests: component tests use `// @vitest-environment jsdom` pragma; live integration tests use `// @vitest-environment node` and must skip gracefully when env vars are absent.
- Design system tokens live in `docs/UI_DESIGN.md` — do not introduce ad-hoc colors or components.

## Change management

- State FILES TO CHANGE / WHY / SCOPE (smallest change necessary). Do not refactor unrelated code.

## Testing honesty

- Never claim a test/build/lint succeeded unless it was actually executed.
- A mocked test does NOT prove real RLS/schema/auth/connectivity.

## Report format

End each implementation/debugging task with: VERIFIED / CHANGED / TESTED / UNVERIFIED / NEXT STEP.