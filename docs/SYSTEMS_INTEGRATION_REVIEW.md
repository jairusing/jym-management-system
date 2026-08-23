# Systems Integration Design Review — Jym Management System

Independent expert review prepared 2026-08-21 for the Systems Integration Design
subject. Every finding is grounded in the actual codebase or infrastructure and
marked **[VERIFIED]** (checked against files/config this session) or
**[INFERENCE]** (reasonable conclusion, not directly checked). Severity:
🟠 MAJOR · 🟡 MINOR · ✅ strength.

## A. Integration architecture

- **A1 🟠 Dual implementation drift — mock vs live repos can silently disagree. [VERIFIED]**
  Every feature ships two implementations (`repository.ts` mock +
  `supabaseRepository.ts` live) with no mechanism forcing behavioral parity.
  Confirmed instance: the dashboard **mock buckets days by browser-local time
  while the live implementation buckets by Asia/Manila** — demo data on a
  non-PH machine differs from production.
  *Fix:* contract tests running both implementations against identical
  fixtures and diffing results; or generate mocks from the live impl.

- **A2 🟠 No CI pipeline — integration tests never gate a push. [VERIFIED]**
  `.github/workflows` does not exist. The 292-test suite runs only when a
  developer remembers; the 69 skipped live-database proofs (RLS, triggers,
  RPCs) have never run automatically.
  *Fix:* minimal GitHub Action — unit suite on every push; nightly or manual
  "live" job fed by repository secrets.

- **A3 🟡 Vercel function endpoints have no documented interface contract. [VERIFIED boundary exists / INFERENCE doc gap]**
  `api/create-login.ts` and `api/link-account.ts` are the only custom HTTP
  integrations (the service-role boundary). Inputs are validated inline but no
  request/response schema, status-code table, or error taxonomy is documented.
  *Fix:* one-page interface control document per endpoint (route, auth
  precondition, payload, 400/401/403/404/409/500 responses).

- **A4 🟡 Total vendor coupling, unacknowledged.**
  Supabase provides auth + database + RLS + RPCs simultaneously. Reasonable
  choice, but the architecture should state it: the repository interfaces ARE
  the integration abstraction seam — document them as such, and note remaining
  leaks (e.g., `auth.getSession()` shape reachable in page logic; Postgres
  error codes translated at repo level ✓).

- **A5 🟡 Client-side aggregation everywhere. [VERIFIED — audit D5]**
  Filtering/sorting/pagination execute client-side over full-table fetches;
  `listBookings()` pulls all bookings on every week change. Acceptable at
  thesis scale; document as an explicit capacity assumption ("≤200 members")
  instead of leaving it implicit. (Tracked as deferred D5.)

## B. Security

- **B1 ✅ Strong core (defend this):** RLS proven by live member-limit tests;
  bcrypt-hashed member PINs behind RPCs with a write-blocking trigger;
  SECURITY DEFINER payment/void RPCs gated by role; service-role key present
  only in server-side env; strict CSP, HSTS, X-Frame-Options DENY,
  nosniff, referrer policy in `_headers` [VERIFIED]; DB-enforced uniqueness,
  class capacity, sequential invoice numbers, and duplicate check-in
  prevention (migration 028).

- **B2 🟠 Known demo credentials exist on the production database. [VERIFIED]**
  The owner test account (`jms.test@demo.jms` / documented password) and the
  member test account live in the real project, and their passwords are
  written in this public repository's HANDOFF.md.
  *Fix:* rotate or disable both accounts before submission; keep credentials
  only as CI secrets.

- **B3 🟡 No application-level rate limiting or bot protection on auth. [VERIFIED absence in code]**
  Six-character minimum password + unlimited attempts is theoretically
  brute-forceable. Document as accepted scope with the mitigation that
  Supabase caps auth request rates.

- **B4 🟡 Role changes and logins are not audited. [VERIFIED — D3 scope note]** The
  immutable trail covers voids/deletes/payment-undos only.

- **B5 🟡 No runtime observability. [VERIFIED — console.warn only]**
  Failed loads, function errors, and RLS denials are invisible unless someone
  opens devtools. Even a free error-tracking tier closes this.

## C. Data integrity & consistency

- **C1 ✅ Strong:** database-enforced invariants throughout — exact-payment
  RPC transaction, partial unique index for one-active-membership, capacity
  trigger, sequence-generated invoice numbers, unique index closing the
  duplicate check-in race (applied to the live database).
- **C2 🟡 Eventual-consistency seams by design** (write-then-refresh with
  honest "list may be out of date" messaging). The pattern is consistently
  implemented but never *named* as an architectural decision — write it down.
- **C3 🟡 No backup/export story beyond attendance CSV (audit G5).** First
  question a real integrator asks.

## D. Design formality & process

- **D1 ✅ Documentation culture is exceptional for a student project:**
  per-release CHANGELOG, HANDOFF, AUDIT with per-item statuses, ERD, RLS
  matrix + threat notes, TESTING evidence tables, UI_DESIGN token spec,
  persisted design-critique archive with score trends.
- **D2 🟡 Missing formal diagrams the subject will expect. [INFERENCE from doc inventory]**
  ERD covers the data view, but there is no architecture/deployment diagram,
  no sequence diagrams for key flows (login→RLS, record-payment RPC
  transaction, create-login service-role call), and no context-level (C4)
  diagram of actors ↔ SPA ↔ Vercel functions ↔ Supabase.
- **D3 🟡 Direct-to-main commits, no PR review; version scheme intentionally
  non-semver (documented as F4).** Acceptable solo — record as process decision.
- **D4 🟡 Script hygiene:** lint/test/build exist; no standalone `typecheck`
  script (tsc runs inside build only).

## Recommended order before submission

| # | Item | Effort | Payoff |
|---|---|---|---|
| 1 | B2 rotate/disable demo owner credentials | minutes | closes a real hole |
| 2 | A2 GitHub Action running the unit suite | ~30 min | proves tests are not decorative |
| 3 | D2 three sequence/architecture diagrams | hours | direct rubric points |
| 4 | A3 endpoint ICDs for the two functions | ~hour | formal completeness |
| 5 | A1/A5 document timezone divergence + capacity assumptions in ARCHITECTURE.md | ~hour | turns known flaws into decisions |

## Defensible strengths

Database-enforced invariants proven by live tests; RLS as the security
boundary with member-limit proofs; Manila timezone correctness end-to-end
(live); honest failure states on every surface after v1.027–v1.044; immutable
audit trail via SECURITY DEFINER triggers; documentation density rare at
student level.
