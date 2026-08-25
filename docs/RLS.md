# RLS Role Model

Row Level Security is the security boundary of Jym Management System. All web
clients authenticate with the **anon key** and are therefore treated as fully
untrusted: every query is filtered by RLS policies. Roles live on
`profiles.role` (`owner | staff | member`, default `member`) and are resolved
per query through the `auth_role()` helper (migration 005).

## Helper

```sql
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;
```

Returns NULL when anonymous, so `anon` matches zero policies and reads zero rows.

## Policy matrix

`S` = row visible / action allowed for that role.

| Table | Action | anon | member (self) | staff | owner |
|---|---|---|---|---|---|
| `profiles` | SELECT | – | own row | all rows | all rows |
| `profiles` | UPDATE | – | own row | – | role changes |
| `membership_plans` | SELECT | – | all | all | all |
| `membership_plans` | INSERT/UPDATE | – | – | yes | yes |
| `membership_plans` | DELETE | – | – | – | yes |
| `members` | SELECT | – | own row | all | all |
| `members` | INSERT | – | – | yes | yes |
| `members` | UPDATE | – | own row | all | all |
| `members` | DELETE | – | – | – | yes |
| `memberships` | SELECT | – | own | all | all |
| `memberships` | INSERT/UPDATE | – | – | yes | yes |
| `memberships` | DELETE | – | – | – | – (none) |
| `invoices` | SELECT | – | own | all | all |
| `invoices` | INSERT/UPDATE | – | – | yes | yes |
| `invoices` | DELETE | – | – | – | – (none) |
| `payments` | SELECT | – | own | all | all |
| `payments` | INSERT/UPDATE | – | – | yes | yes |
| `payments` | DELETE | – | – | – | – (none) |
| `check_ins` | SELECT | – | own | all | all |
| `check_ins` | INSERT | – | – | yes | yes |
| `check_ins` | UPDATE/DELETE | – | – | – | – (none) |
| `classes` | SELECT | – | all | all | all |
| `classes` | INSERT/UPDATE | – | – | yes | yes |
| `classes` | DELETE | – | – | – | yes |
| `class_sessions` | SELECT | – | all | all | all |
| `class_sessions` | INSERT/UPDATE | – | – | yes | yes |
| `class_sessions` | DELETE | – | – | – | – (none) |
| `class_bookings` | SELECT | – | own | all | all |
| `class_bookings` | INSERT | – | own | yes | yes |
| `class_bookings` | UPDATE | – | – | yes | yes |
| `class_bookings` | DELETE | – | – | – | – (none) |

"Own" means `members.user_id = auth.uid()` for business tables, i.e. the
member's own row and records tied to it (`memberships`, `invoices`,
`payments`, `check_ins`, `class_bookings`).

## Role boundaries (thesis chapter summary)

1. **Owner** — full administrative control: deletes (members, classes, plans),
   role management (`profiles_update_role_owner`), everything staff can do.
2. **Staff** — runs daily operations: member CRUD, check-ins, invoices,
   payments, classes, sessions, bookings. Cannot delete business records;
   deletion is owner-only or blocked entirely (`delete_none`). Can void
   *issued* invoices (migration `027` relaxed the owner-only trigger); a
   *paid* invoice can only move back to issued through the owner-only
   `rpc_void_invoice` (undo payment — removes the payment rows).
3. **Member** — read and act only on their own data: own profile, own records,
   booking insert for their own member row, class catalog read. Cannot see
   other members' data, check-ins, invoices, or payments.
4. **Anonymous** — reads zero rows everywhere; `auth_role()` is NULL.

## Stored procedures (SECURITY DEFINER, auth_role()-gated)

- `rpc_record_payment` (staff+owner) — atomic payment + invoice-paid +
  membership renewal; requires exact total; invoice must be `issued`.
- `rpc_void_invoice` (staff: issued invoices; owner: also paid = undo) —
  issued → `void` (audit-logged by trigger); paid → payment rows deleted,
  invoice back to `issued`, `paid_at` cleared, `undo_payment` audit row.
- `rpc_set_member_pin` / `rpc_verify_member_pin` (staff+owner).

## Threat model notes

- The anon key is public (shipped to the browser); RLS, not key secrecy, is the
  boundary. Service-role credentials never leave the server.
- `delete_none` policies make financial and booking history immutable at the
  data layer, not just the UI.
- `processed_by` (check-ins, payments) is supplied by the signed-in client and
  RLS restricts inserts to staff/owner; forging another staff id is possible
  but out of thesis scope (single-owner operation).
- Unique constraint `class_bookings (session_id, member_id)` blocks double
  bookings at the data layer.
- Accepted scope (B3): no application-level rate limiting or CAPTCHA on
  auth. Supabase Auth applies built-in request throttling per project; the
  six-character password minimum is documented as audit item E1. Revisit if
  deployed to a real gym with public sign-ups.

## Verification evidence

- Migration 005 applied to the live project; `anon` session returned **0 rows**
  on every business table (Phase 3 verification).
- `supabase db lint` clean on migrations 001–005.
- 7 live integration suites (`*.integration.test.ts`) exercise the full
  staff/owner path end-to-end; run them with `JYM_TEST_EMAIL` /
  `JYM_TEST_PASSWORD` set (see `docs/TESTING.md`).