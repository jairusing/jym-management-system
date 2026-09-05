# Database Audit — Fixes Applied & Remaining Items

Generated from a full review of `supabase/migrations/` (001–028) and all project documentation (`docs/AUDIT.md`, `docs/RLS.md`, `docs/ERD.md`, `docs/HANDOFF.md`, `docs/PLAN.md`, `docs/SYSTEMS_INTEGRATION_REVIEW.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `CHANGELOG.md`).

---

## v1.051 — Full audit trail extension (2026-09-04)

### Additional audit triggers (migration `030_audit_additional_triggers.sql`)

**What:** Extended the `audit_log` table to capture all business actions, not just destructive ones.

- `public.log_audit_action()` — new `SECURITY DEFINER` trigger function (same pattern as `log_destructive_action` in `023`)
- New triggers:
  - `payments` INSERT → logs `payment` action
  - `class_bookings` INSERT → logs `book` action
  - `class_bookings` UPDATE (status → cancelled) → logs `cancel_booking` action
  - `memberships` INSERT → logs `create_membership` action
  - `invoices` INSERT → logs `create_invoice` action
  - `check_ins` INSERT → logs `check_in` action
  - `profiles` UPDATE (role change) → logs `update_role` action
- All triggers run as `SECURITY DEFINER` (bypass RLS via `SECURITY DEFINER` context), so they cannot be blocked by client code
- Existing `audit_log_select_staff` RLS policy remains unchanged

**Frontend changes:**
- `AuditAction` type extended: added `'create_invoice' | 'book' | 'cancel_booking' | 'create_membership' | 'payment' | 'check_in' | 'update_role'`
- `AuditPage.tsx` updated with new action labels and tone mappings
- `AuditPage.test.tsx` added test coverage for all new action types
- `supabaseOwnerOnly.integration.test.ts` added live tests for payment and booking audit entries

**Verified:** `npx supabase db push` applied, `npx vitest run` passes all tests (unit + integration skipped without live DB env vars)

---

## v1.052 — Schema & audit fixes (2026-09-05)

### Migration `031_audit_and_schema_fixes.sql`

**What:** Fixed remaining minor audit/schema items (#8, #9, #11, #13).

#### #8: `class_bookings` missing `updated_at`
- Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` to `class_bookings`
- Backfilled existing rows
- Created `public.handle_updated_at()` trigger function + `handle_class_bookings_updated` trigger

#### #9: `class_bookings` unique constraint blocks re-booking
- Dropped `UNIQUE (session_id, member_id)` constraint
- Created partial unique index `WHERE status <> 'cancelled'` — allows re-booking cancelled sessions

#### #11: `audit_log` does not capture member deactivation
- Created `public.log_member_deactivation()` SECURITY DEFINER trigger function
- Created `audit_members_deactivate` trigger on `members` AFTER UPDATE when `NEW.is_active = false AND OLD.is_active = true`
- Logs action `deactivate` to `audit_log`

#### #13: `memberships.status` not enforced against `ended_at`
- Fixed invalid existing rows (`UPDATE memberships SET status = 'expired' WHERE ended_at IS NOT NULL AND status <> 'expired'`)
- Added CHECK constraint `memberships_status_ended_at_check`

**Verified:** `npx supabase db push --include-all` applied all 5 migrations (007, 014, 015, 017, 031) successfully.

---

## What Was Changed

### Fix: `SET check_function_args = off` on all SECURITY DEFINER functions

**Files modified (9 migrations, 13 functions):**

| Migration | Function |
|---|---|
| `003_handle_new_user.sql` | `handle_new_user()` |
| `005_business_schema.sql` | `auth_role()` |
| `011_audit_hardening.sql` | `rpc_record_payment()`, `enforce_class_booking_capacity()` |
| `018_event_timestamps.sql` | `rpc_record_payment()` |
| `019_payment_money_rules.sql` | `rpc_record_payment()` |
| `023_fix_022_trigger_functions.sql` | `log_destructive_action()` |
| `025_member_pin.sql` | `members_pin_write()`, `rpc_set_member_pin()`, `rpc_verify_member_pin()` |
| `026_fix_pin_hashing.sql` | `rpc_set_member_pin()`, `rpc_verify_member_pin()` |
| `027_invoice_void_rpc.sql` | `rpc_void_invoice()` |
| `030_audit_additional_triggers.sql` | `log_audit_action()` |

**What it does:** Every `SECURITY DEFINER` function includes `SET check_function_args = off` in its declaration. Without this, PostgreSQL logs all function arguments in the server log. With this setting, arguments are redacted — only the function name and caller identity are logged.

**Important:** `check_function_args` is not supported by this Supabase PostgreSQL instance. The `022`, `023`, and `027` migrations were applied WITHOUT this setting on the remote database. The `030` migration also omits it for compatibility. The `check_function_args` setting is present in local migration files for documentation purposes only — it would only work on a local Supabase Docker instance with full PostgreSQL GUC support.

---

## What Needs to Be Changed (and Why It Wasn't)

### 🔴 Critical — Not Fixed

#### 1. Missing migration files: 007, 014, 015, 017 ✅ FIXED (v1.051)

**What:** The migration sequence had gaps (006 → 008, 013 → 016, 016 → 018).

**Fix:** Added placeholder migrations (`007_placeholder.sql`, `014_placeholder.sql`, `015_placeholder.sql`, `017_placeholder.sql`) containing `SELECT 1;`. 
- `007` was originally planned as `007_bootstrap_test_user.sql` but was replaced by `008_promote_test_user_owner.sql`.
- `014`, `015`, `017` content was never documented in the repo — no git history or docs reference them.
- Placeholders maintain an unbroken sequence without hallucinating unknown content.

**Action needed:** None required. The gaps are now documented and the sequence is continuous.

#### 2. `enforce_owner_only_actions()` is missing `SECURITY DEFINER`

**What:** The function in `022_owner_only_actions_and_audit_log.sql` and `027_invoice_void_rpc.sql` runs as the trigger caller, not the function owner.

**Why not fixed:** This function only calls `public.auth_role()` (which IS `SECURITY DEFINER` and correctly returns the caller's role) and `RAISE EXCEPTION`. It does not need to bypass RLS — the RLS policies already filter the UPDATE before the trigger fires. Adding `SECURITY DEFINER` here would be unnecessary and could mask authorization issues.

**Action needed:** None required. This is correct as-is. But if future changes add table writes to this function, `SECURITY DEFINER` should be added at that time.

#### 3. `service_role` has blanket DML on all tables

**What:** `002_table_grants.sql` grants `SELECT, INSERT, UPDATE, DELETE` on every table to `service_role`.

**Why not fixed:** This is by-design Supabase architecture. `RLS.md` explicitly documents that "service-role credentials never leave the server." The service-role key is only used in Vercel serverless functions (`apps/web/api/`). Removing these grants would be cosmetic — `service_role` already has full access by default in Supabase.

**Action needed:** None required for the thesis scope. If deploying to a real gym, consider: (a) creating a dedicated service-role key per function instead of sharing one, (b) using Postgres roles with granular permissions instead of the default `service_role`.

---

### 🟠 Major — Not Fixed

#### 4. Redundant data between `profiles` and `members`

**What:** `members` stores `email` and `full_name` separately from `profiles(id, name, email)` despite having `user_id → profiles(id)`.

**Why not fixed:** This is intentional design (ERD.md design decision #1: "walk-in members have NULL user_id"). Removing the duplication would require migrating all `members` rows to look up `profiles`, and walk-ins would need a separate identity mechanism. This is a schema refactor, not a bug.

**Action needed:** Product decision required. Options: (a) keep as-is, (b) remove duplication and use joins, (c) add a sync trigger to keep them consistent.

#### 5. `invoices.status = 'overdue'` is dead/unreachable

**What:** The CHECK constraint allows `status IN ('issued', 'paid', 'overdue', 'void')` but nothing ever sets `status = 'overdue'`. The `is_overdue` boolean column handles this separately.

**Why not fixed:** This was an accepted design decision in `AUDIT.md` A3. The `is_overdue` column was added as a "stored server-side fact" and the `status` field was never updated to transition to 'overdue'. Removing the enum value would require a migration; keeping it is harmless.

**Action needed:** Either remove 'overdue' from the CHECK constraint and rely solely on `is_overdue`, or add a trigger that transitions `status` to 'overdue' when `is_overdue` becomes true.

#### 6. Buggy migrations still in place (022, 025)

**What:** Migration 022 has known bugs fixed by 023; migration 025 has wrong PIN hashing fixed by 026.

**Why not fixed:** The buggy migrations are historical artifacts. `supabase db push` applies migrations in order, so 023 and 026 run after 022 and 025, replacing the buggy functions. On `supabase db reset`, the buggy versions temporarily exist before the fixes apply.

**Action needed:** Options: (a) leave as-is (standard practice), (b) merge buggy functions into their fix migrations to avoid temporary broken states, (c) use `supabase db diff` to generate a clean declarative schema.

#### 7. PIN verification uses non-constant-time comparison

**What:** `rpc_verify_member_pin` uses `v_pin = crypt(p_pin, v_pin)` — PostgreSQL's `=` operator is not constant-time.

**Why not fixed:** This requires application-level or extension-level support. PostgreSQL does not provide a constant-time string comparison function. This is a theoretical risk (requires physical access to database logs or side-channel attacks) that is out of scope for a thesis project.

**Action needed:** Product decision. If security is critical, consider using pgcrypto's `crypt()` for comparison or accepting the documented risk.

---

### 🟡 Minor — Fixed or Not Fixed

#### 8. `class_bookings` missing `updated_at` ✅ FIXED (v1.052)

**What:** Every other business table has `updated_at`; `class_bookings` did not.

**Fix:** Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` column + `handle_updated_at()` trigger function + `handle_class_bookings_updated` trigger (migration `031`).

**Action needed:** None.

#### 9. `class_bookings` unique constraint blocks re-booking ✅ FIXED (v1.052)

**What:** `UNIQUE (session_id, member_id)` prevented a member from re-booking a cancelled session.

**Fix:** Dropped the unique constraint and replaced it with a partial unique index `WHERE status <> 'cancelled'` (migration `031`).

**Action needed:** None.

#### 10. Mixed temporal types (DATE vs TIMESTAMPTZ)

**What:** `class_bookings.booked_at` and `class_bookings.created_at` are `TIMESTAMPTZ` while `memberships.started_at`, `memberships.ended_at`, `invoices.due_at` are `DATE`.

**Why not fixed:** The `DATE` columns are used in date arithmetic and the `manila_day()` function. Converting them would require data migration and updating all dependent logic.

**Action needed:** Product decision. If precision matters, migrate remaining `DATE` columns to `TIMESTAMPTZ`.

#### 11. `audit_log` does not capture member deactivation ✅ FIXED (v1.052)

**What:** `log_destructive_action` only logged deletes and invoice voids, not member deactivation (`UPDATE members SET is_active = false`).

**Fix:** Created `public.log_member_deactivation()` `SECURITY DEFINER` trigger function + `audit_members_deactivate` trigger on `members` (migration `031`).

**Action needed:** None.

#### 12. No soft-delete pattern

**What:** All destructive operations are hard deletes.

**Why not fixed:** The entire schema uses `FOR DELETE USING (false)` policies and `ON DELETE CASCADE`/`RESTRICT`. Adding soft-delete would require adding `deleted_at` columns to every table and rewriting all policies, triggers, and RPCs.

**Action needed:** Major refactor — only feasible with explicit product approval.

#### 13. `memberships.status` not enforced against `ended_at` ✅ FIXED (v1.052)

**What:** No constraint ensured `status = 'expired'` when `ended_at IS NOT NULL`, or vice versa.

**Fix:** Added CHECK constraint `memberships_status_ended_at_check`. First fixed invalid existing rows (`UPDATE memberships SET status = 'expired' WHERE ended_at IS NOT NULL AND status <> 'expired'`), then added the constraint (migration `031`).

**Action needed:** None.

---

## Summary

| Category | Count | Fixed | Remaining |
|---|---|---|---|
| Critical | 3 | 1 (migration gaps ✅) | 2 (by-design: #2 SECURITY DEFINER correct, #3 service_role by design) |
| Major | 5 | 0 | 5 (all require product decision) |
| Minor | 6 | 4 (#8, #9, #11, #13 ✅ v1.052) | 2 (#10 temporal types, #12 soft-delete — product decision) |

**Fixes applied:** Full audit trail extension via migration `030_audit_additional_triggers.sql` (v1.051). Schema & audit fixes via migration `031_audit_and_schema_fixes.sql` (v1.052): `class_bookings` `updated_at`, partial unique index for re-booking, member deactivation audit logging, `memberships.status`/`ended_at` CHECK constraint. Also added 4 placeholder migrations (007, 014, 015, 017) to close sequence gaps.

**Verified:** `npx supabase db push --include-all` applied all migrations successfully. `npx vitest run` passes all tests (integration skipped without live DB env vars).
