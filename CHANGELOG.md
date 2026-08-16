# Changelog

All shipped changes are tracked here with a version number. The version shown on the
Profile page (and in `apps/web/package.json`) always matches the latest entry below.
Every time a change ships, the version bumps (1.001 → 1.002 → 1.003, …) and a new
entry is added at the top of this file.

## v1.002 — Button layout fix on list rows (2026-08-16)

- Fixed action buttons (Statement / Record payment / Void on invoices, and the
  member actions on the Members page) wrapping below the row when the description
  text is long. The action buttons now stay on one horizontal line; the text side
  shrinks and wraps instead.
- No behavior changes; cosmetic only.

## v1.001 — Front-desk usability overhaul (2026-08-16)

First versioned release. Baseline: member accounts, check-in QR, class bookings,
payments, member statements, and owner staff management were already live; this
release makes the lists usable by a gym owner or staff at the front desk.

### Members
- Search by name, phone, or email.
- Status chips (All / Active / Inactive) and membership filter (Any / Active / Expired / No membership).
- Pagination: 15 per page with "Showing 1–15 of N" and Prev/Next controls.

### Check-ins
- Reorganized into three tabs: Check in, Today, History.
- Empty search now shows the 5 most recent members instead of every member.
- Expired memberships are flagged on the row and the check-in button is disabled (QR path still shows the renewal message).
- Today list capped at the latest 10 with a jump to full history.
- History capped at 200 rows (narrow the range or export CSV for the rest).

### Payments
- At-a-glance summary strip: Outstanding, Collected this month, Overdue invoices.
- Two tabs: Invoices, Payments.
- Status chips with counts (All / Issued / Overdue / Paid / Void).
- Pagination on both lists (15 per page).
- Every invoice row links to the member's statement page.

### Design system
- New shared `StatusBadge` component with one meaning per color: green = active/paid,
  amber = issued/expiring, red = expired/overdue/inactive, gray = void/cancelled.
  (Fixes: "paid" was gray, "issued" was red.)
- New shared `Tabs` component.
- Muted text contrast raised `#737373` → `#A3A3A3` across all pages; badge text size
  standardized to 12px.
- Version indicator added to the Profile page.

### Verified
- Full suite: 146/146 tests passing, including live Supabase integration tests
  (member-limits, ledger, staff role changes). TypeScript, ESLint, and production
  build all clean.