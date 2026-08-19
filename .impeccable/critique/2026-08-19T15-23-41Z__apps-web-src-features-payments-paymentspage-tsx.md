---
target: apps/web/src/features/payments/PaymentsPage.tsx
total_score: 34
max_score: 40
na_heuristics: 0
p0_count: 1
p1_count: 2
p2_count: 2
timestamp: 2026-08-19T15-23-41Z
slug: apps-web-src-features-payments-paymentspage-tsx
---
# Critique Round 5 — Payments (v1.019)

- Target: apps/web/src/features/payments/PaymentsPage.tsx
- Score: 34/40
- Findings implemented in v1.019:
  - P0: write-then-refresh lie — split write/refresh; load() returns boolean; honest combined message on refresh failure (create/record/void).
  - P1: loadRole failure silently hid Void — role alert + Retry role button.
  - P1: focus fell to body after recording a payment — Statement link focused after refresh.
  - P2: void focus fallback never matched (lowercase id vs label aria-label) — selector uses chip label.
  - P2: Issue form usable during loading/error — disabled fieldset + hint line.
- Deferred (need user approval / policy decision):
  - P1: staff Void + paid-invoice void RPC (schema change).
  - P2: restrict paymentMethods to Cash/GCash.
- Score trend: 23 → 21 → 28 → 30 → 34.
