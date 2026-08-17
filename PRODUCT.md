# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** a small independent gym's owner and front-desk staff. Their daily job is running operations at the desk — checking members in, taking/renewing payments, enrolling members, managing the class schedule — mostly from a laptop.
- **Secondary (confirmed):** gym members, who check in daily via QR code or PIN and can view their own membership and statement.

## Product Purpose

Run one small gym's entire member operation from a single web app: member records, QR + PIN check-ins, memberships (plans, renewals, pause/cancel), record-only payments and invoices, class schedule with bookings, per-member ledger statements, and an audit trail. Success means the front desk stops juggling paper and spreadsheets and the owner can see attendance, revenue, and member status at a glance.

## Positioning

An all-in-one operations tool for a single gym whose trustworthiness is its edge: RLS-secured Supabase, mutations gated behind RPCs (bcrypt-hashed member PINs, no plaintext secrets), and a full audit log — security posture usually absent from small-gym tools. It records money, it does not process it.

## Operating Context

- Front-desk laptop at the gym, in short bursts between members.
- Members check in every visit: staff picks the member (or scans the QR code) and the system asks for the member's 4–6 digit PIN when one is set.
- Payments are recorded as cash or GCash with a reference number; nothing is charged online.
- Owner reviews the dashboard (attendance, revenue, overdue) and per-member statements; staff log their collections.
- Deployed: Vercel auto-deploy from `main` → https://jym-management-system.vercel.app/, Supabase (Postgres + RLS) as backend. Dev server: `apps/web`, port 3000.

## Capabilities and Constraints

- **Auth & roles:** sign up, sign in, password reset, protected routes; three roles — owner, staff, member (self-service).
- **Members:** CRUD, QR code per member, optional PIN (Set PIN panel), login creation/linking for walk-ins, activate/deactivate, delete (owner-gated where required).
- **Check-ins:** manual and QR paths; PIN-required when set; blocked for inactive, paused, or cancelled memberships; history with staff attribution.
- **Memberships:** plans, renewals, pause/resume/cancel (with explicit confirms), price snapshotted at invoice time (plan price changes do not rewrite history).
- **Payments:** invoices in ₱, record-only cash/GCash with reference; issue, record payment, void (owner only); collected-by-staff totals.
- **Classes:** schedule, bookings, capacity.
- **Audit:** actions logged; RLS is the security boundary; sensitive mutations (PIN) only via RPCs; CSP + security headers.
- **Constraints:** no payment processor; single gym, no multi-branch/multi-tenant; versioned ship process (currently v1.013) with a changelog; full test suite (240 tests incl. live-DB integration) must stay green.

## Brand Commitments

- Name: **Jym** (product docs call it "Jym Management System" / "Jym Tracker").
- **Bold Typography** design system in `docs/UI_DESIGN.md` is binding: poster-derived typographic language, dark theme, accent `#FF3D00`, restrained use of color. Do not replace with generic SaaS/dashboard styling.
- Thesis/business project — academic context is durable.

## Evidence on Hand

- `docs/UI_DESIGN.md` — authoritative visual specification (Bold Typography).
- `docs/AUDIT.md` — security audit (C/B/A findings; C2 fixed in v1.010).
- `docs/ERD.md`, `docs/DATABASE.md`, `docs/RLS.md`, `docs/USER_FLOWS.md`, `docs/ARCHITECTURE.md`.
- `CHANGELOG.md` — full ship history through v1.013.
- `supabase/migrations/` — applied schema (001–026 live).
- Live deployment: https://jym-management-system.vercel.app/
- No testimonials, customers, or benchmarks exist; none may be invented.

## Product Principles

1. **Records must be trustworthy** — audit log, RLS, and hashed secrets are the product's edge, not optional plumbing.
2. **Check-in is the highest-frequency moment** — it must be the fastest, least-error-prone action at the desk.
3. **Record truth, not process** — payments record what happened; they never route money.
4. **The owner sees the whole business at a glance** — dashboard and statements answer questions without asking staff.
5. **Single-gym honesty** — scope stays within what one real gym needs; no invented features or claims.
