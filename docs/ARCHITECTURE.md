# Architecture

Jym Management System — a gym front-desk application (Philippines; PHP
currency; Asia/Manila timezone everywhere). This document is the
architecture/deployment reference: system context, runtime topology, and the
sequence diagrams for the three flows that cross trust boundaries.

## Stack

- **Web**: React 18 + TypeScript + Vite + Tailwind CSS, in `apps/web/`
- **Backend**: Supabase (PostgreSQL + Auth + Row Level Security + database
  triggers/RPCs), schema in `supabase/migrations/` (001–028)
- **Serverless**: two Vercel functions in `apps/web/api/` — the only custom
  HTTP endpoints; they hold the service-role key server-side (see
  `docs/API_CONTRACTS.md`)
- **Deploy**: Vercel, auto-deploy on push to `main` (`jym-management-system.vercel.app`)
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) runs lint + unit tests +
  build on every push/PR; live-database integration tests skip without secrets

## System context (C4 level 1)

```mermaid
graph LR
  Owner([Owner])
  Staff([Staff])
  Member([Member])

  subgraph JymMS["Jym Management System"]
    SPA["React SPA<br/>(browser)"]
    FN["Vercel Functions<br/>create-login / link-account<br/>holds SERVICE_ROLE key"]
  end

  Supa["Supabase<br/>Postgres + RLS + Auth<br/>triggers + RPCs"]

  Owner -->|HTTPS| SPA
  Staff -->|HTTPS| SPA
  Member -->|HTTPS| SPA
  SPA -->|"Supabase JS (anon key + JWT)<br/>every query passes RLS"| Supa
  SPA -->|"POST /api/*<br/>Bearer JWT"| FN
  FN -->|"anon client: verify token"| Supa
  FN -->|"admin client: SERVICE_ROLE<br/>(bypasses RLS, server only)"| Supa
```

Trust boundary: everything inside the browser is untrusted. The database is
protected by RLS policies for every direct path; the two functions are the
only place where the service-role key may act above RLS.

## Deployment topology (C4 level 2)

```mermaid
graph TB
  subgraph Browser["User's browser"]
    APP["Static React bundle<br/>(Vite build output)"]
  end
  subgraph Vercel["Vercel edge"]
    STATIC["Static hosting<br/>+ _headers (CSP/HSTS)"]
    APIF["Serverless functions<br/>/api/create-login<br/>/api/link-account"]
  end
  subgraph SupabaseCloud["Supabase project osujvqcsomfawxxrhjty"]
    AUTH["Auth (GoTrue)<br/>email+password, email confirmation"]
    PG[("PostgreSQL<br/>11 tables + audit_log<br/>RLS on every table")]
    RT["Triggers &amp; RPCs<br/>rpc_record_payment,<br/>rpc_void_invoice,<br/>rpc_verify_member_pin,<br/>audit triggers"]
  end
  GH["GitHub main branch"] -->|push| VER["Vercel build"]
  VER --> STATIC
  VER --> APIF
  APP -->|REST over HTTPS| PG
  APP -->|auth endpoints| AUTH
  APIF --> AUTH
  APIF --> PG
  RT --- PG
```

## Key sequence diagrams

### 1. Sign-in → RLS-scoped data access

```mermaid
sequenceDiagram
  actor U as Staff/Owner browser
  participant A as Supabase Auth
  participant P as Postgres (profiles)
  participant R as Postgres (business tables + RLS)

  U->>A: signInWithPassword(email, password)
  A-->>U: access token (JWT, role claim via profiles)
  U->>P: select role where id = auth.uid()
  P-->>U: role (drives UI gating, NOT security)
  U->>R: every query carries the JWT
  Note over R: RLS policies re-derive the role from the JWT on every row
  R-->>U: only rows the policies allow (e.g. members cannot read others)
```

The UI hides buttons by role, but security comes exclusively from RLS — a
crafted request without permission returns zero rows or an error.

### 2. Record payment (atomic RPC transaction)

```mermaid
sequenceDiagram
  actor S as Front desk (staff)
  participant SPA as React
  participant RPC as rpc_record_payment()<br/>SECURITY DEFINER
  participant DB as Postgres tables

  S->>SPA: amount + method (+ reference)
  SPA->>RPC: call with invoice id, member id, amount, method
  Note over RPC: row-locks the invoice; verifies caller is staff/owner;<br/>verifies amount = invoice total exactly
  RPC->>DB: insert payments row (processed_by = caller)
  RPC->>DB: update invoices set status='paid', paid_at=now()
  RPC->>DB: expire prior active membership; insert new active membership<br/>(extends from previous end date when renewing early)
  RPC-->>SPA: success (single atomic transaction — no partial states)
```

Failure at any step rolls back the whole transaction: money can never be
recorded against an unpaid-or-wrong-amount invoice, and a paid invoice can
never silently gain a second membership.

### 3. Create member login (service-role boundary)

```mermaid
sequenceDiagram
  actor O as Owner/Staff
  participant SPA as React
  participant F as /api/create-login<br/>(Vercel, service-role)
  participant AU as Supabase Auth admin
  participant M as members table

  O->>SPA: choose walk-in member + email + password
  SPA->>F: POST Bearer JWT {memberId, email, password}
  F->>AU: getUser(bearer) — verify caller identity
  F->>M: read profiles.role of caller (must be owner/staff)
  F->>M: member exists AND user_id IS NULL?
  alt any precondition fails
    F-->>SPA: 400/401/403/404/409 with human copy
  else ok
    F->>AU: admin.createUser(email, password, email_confirm=true)
    F->>M: update members.user_id = new user id
    alt link fails
      F->>AU: delete created user (rollback)
      F-->>SPA: 500 "Failed to link…"
    else linked
      F-->>SPA: 200 {ok:true, email}
    end
  end
```

Full request/response contracts for both functions (including link-account):
`docs/API_CONTRACTS.md`.

## Structure

```
apps/web/
  api/
    create-login.ts             Serverless function (service-role boundary)
    link-account.ts             Serverless function (service-role boundary)
  src/
    main.tsx                    Entry point
    App.tsx                     Routes (auth + protected shell)
    lib/supabase.ts             Supabase client from env vars; null when unconfigured
    lib/dates.ts                Manila-timezone helpers used everywhere
    components/ui/              Design system: PageShell, Tabs, SectionCard,
                                StatusBadge, RowMenu, ConfirmModal, buttonClasses…
    features/
      auth/                     AuthContext, AuthPage, ProfilePage, reset flow
      dashboard/                Owner landing page (stats, weekly chart, renewal reminders)
      members/                  Members CRUD, logins/linking, PINs, memberships
      checkins/                 Check in (search/QR/PIN), today list, history + CSV
      classes/                  Class definitions, weekly sessions, bookings
      payments/                 Invoices, record-payment, void/undo, staff totals
      ledger/                   Member statements
      staff/                    Role management (owner-gated)
      audit/                    Read-only activity log (audit trail)
      memberAccounts/           create-login/link-account client wrappers
      membership/               Member self-service view
```

## Cross-cutting decisions

- **Repository pattern** per feature: interface + mock (unit tests + dev
  fallback behind `hasSupabaseConfig`) + Supabase implementation + component
  tests + live integration tests that skip without env vars.
- **Write-then-refresh consistency**: mutations write first, then refresh the
  affected lists; if the refresh fails the UI says so explicitly instead of
  pretending success ("…but the list may be out of date").
- **Timezone correctness**: every timestamp renders in Asia/Manila; day
  boundaries (today/week/month/grace/expiry) use Manila calendar dates via
  `lib/dates.ts`; the duplicate-check-in unique index uses an IMMUTABLE
  `manila_day()` SQL helper.
- **Error copy standard**: users see human sentences; raw errors go to
  `console.warn`; known domain messages pass through whitelists.
- **Known capacity assumptions** (deliberate scope): lists are fetched whole
  and paginated client-side — comfortable to ~200 members / a few thousand
  rows; server-side pagination is deferred (audit D5).
- **Known divergence**: the dashboard MOCK buckets days by browser-local time;
  the live implementation buckets by Manila. Demo-only, documented in HANDOFF.
