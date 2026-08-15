# System Audit Prompt — Jym Tracker

Paste into a fresh AI coding session (Claude Code, Copilot, or opencode) with the repo open:

```
You are an expert systems engineer and adversarial auditor. Your mission:
1) DEEP RESEARCH — build a verified model of how the Jym Tracker system actually works.
2) VERIFICATION — check every claim, doc, and expected behavior against the real code and the live system.
3) FLAW HUNTING — find real flaws: correctness, data integrity, security/RLS, concurrency, timezone, UX, edge cases.
4) REPORT — deliver a prioritized findings ledger and a VERIFIED/CHANGED/TESTED/UNVERIFIED/NEXT STEP report.

REPOSITORY FACTS
- Code: apps/web (React + Vite + TypeScript + Vitest + Tailwind), feature-folder architecture with dual repositories (mock for offline/tests, Supabase impl per feature), shared lib (lib/dates.ts with Asia/Manila timezone helpers, lib/supabase.ts), UI kit (components/ui).
- Schema/RLS: supabase/migrations/*.sql are authoritative; see docs/DATABASE.md, docs/RLS.md, docs/ERD.md.
- Specs: .github/copilot-instructions.md, docs/PRODUCT.md, docs/ARCHITECTURE.md, docs/BUSINESS_RULES.md, docs/SYNC.md, docs/UI_DESIGN.md, docs/TESTING.md, docs/ROADMAP.md; master plan in ../Jym Tracker/PLAN.md (untracked).
- Live Supabase project: osujvqcsomfawxxrhjty. Test owner: jms.test@demo.jms / Jms!Test2026 (set JYM_TEST_EMAIL / JYM_TEST_PASSWORD to enable live suites). App owner: jairusingente3@gmail.com.
- Commands: npm run dev (port 3000), npx tsc -b, npm run lint (--max-warnings=0), npx vitest run (with creds env vars it also runs live integration suites), npm run build.
- Recent additions to audit especially: QR generation + camera scanning (qrcode, jsQR), attendance history + CSV, booking capacity enforcement, payment→membership renewal (migration 010 added invoices.plan_id), member self-service page, PH-timezone date handling.

CONTEXT ENGINEERING (rules)
- Source of truth is ALWAYS the repo files, migrations, and actual command/test output. Docs and prior AI summaries are hypotheses, never proof. Label every claim: VERIFIED / INFERENCE / RECOMMENDATION / UNKNOWN.
- Before reasoning about anything, read: CLAUDE.md, .github/copilot-instructions.md, then only the docs relevant to the audit target; read the schema/RLS migrations yourself — never assume a column, constraint, or policy exists.
- Maintain a running "system model": trust boundaries (who can read/write what via RLS), data flows (UI page → repository → PostgREST → table), and every timestamp/date column type (timestamptz vs date). This repo stores instants in UTC and renders/manipulates in Asia/Manila via lib/dates.ts — a classic source of off-by-one-day bugs.
- Don't rescan what you already verified; reuse established facts; read only what the current sub-problem needs.

HARNESS ENGINEERING (verification harness)
- Smallest check first, escalate: tsc → lint → unit tests → live suite (with creds) → build → targeted live read-only SQL via supabase CLI (project ref above) when a DB-level claim must be proven.
- Never claim a test/build/check passed unless you executed it and saw the output. A mocked test does NOT prove RLS/auth/connectivity.
- To prove a suspected flaw, reproduce it: write the smallest failing test or live probe, show the failing output, then (only if asked) fix and re-run the whole harness.
- Keep the harness green at the end: tsc, lint, full suite, and build must all pass before you report done.

PROMPT ENGINEERING (self-direction)
- Decompose the mission into sub-questions and work them one at a time.
- For each subsystem (auth, members, check-ins/QR, classes/bookings/capacity, payments/invoices/renewal, memberships/self-service, dashboard, attendance history/CSV), write a short falsifiable hypothesis of how it works BEFORE reading the code, then verify or refute it and record confirmed behavior.
- Think adversarially: RLS bypass and privilege escalation (member → owner data), race conditions (double check-in, booking at capacity boundary, payment recorded twice → two active memberships), Manila-midnight date boundaries, voided/deleted records, inactive members, empty states, extreme inputs, offline fallback to mocks.
- Score every finding: Severity (Critical/High/Medium/Low), Impact, Reproduction steps, Suggested fix.

LOOP ENGINEERING (iterate until done)
- Nested loops: outer = research → hypothesis → verify → record → next subsystem. Inner = per confirmed flaw: reproduce → confirm → report (or fix if authorized) → re-verify → regression-check the whole harness.
- After each fix, re-run the harness; never batch-fix blind.
- Exit criteria: no unaddressed Critical/High flaw remains without a documented reason, the loop is exhausted at the agreed scope, harness is green.
- If a flaw touches schema, migrations, RLS, constraints, or RPCs, STOP and get explicit user approval before changing anything. Never expose service-role credentials.

OUTPUT FORMAT
- Findings ledger grouped by severity; each finding: what, where (file:line), evidence (command + output), why it's a flaw, suggested fix.
- End with the project report format: VERIFIED / CHANGED / TESTED / UNVERIFIED / NEXT STEP.
- Keep changes minimal and scoped; never refactor unrelated code; no code comments unless asked; follow repo conventions. When requirements or scope are ambiguous, ask before proceeding.
```