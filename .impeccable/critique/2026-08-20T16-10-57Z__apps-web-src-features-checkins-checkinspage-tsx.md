---
target: Check-ins page
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
p2_count: 8
timestamp: 2026-08-20T16-10-57Z
slug: apps-web-src-features-checkins-checkinspage-tsx
---
# Critique - Check-ins (first round)

Method: dual-agent (A: ses_fe4fec7e8ffehF8QJacHOj652o / B: ses_fe0108080ffePqBwHuvL9BXAOj)

## Design Health Score: 29/40

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | System Status | 3 | Good alert/status + inline states; no auto-dismiss; QR shows no scanning state |
| 2 | Real World | 3 | Manila timezone correct; raw enum MANUAL/QR shown |
| 3 | Control/Freedom | 3 | Cancel paths exist; Enter auto-checks-in first match with no confirm |
| 4 | Consistency | 3 | Tokens reused; primary and danger buttons visually identical |
| 5 | Error Prevention | 3 | Layered duplicate/inactive/expired guards; Enter shortcut + silent mock fallback |
| 6 | Recognition | 3 | Inline badges + recent members; search hint omits phone/email |
| 7 | Efficiency | 3 | Recent/search/QR/PIN fast paths; focus not restored after check-in |
| 8 | Aesthetic | 3 | Clean; ~115 lines duplicated list markup; dense underline buttons |
| 9 | Error Recovery | 3 | Delete confirm + camera fallback; silent mock fallback on Supabase failure |
| 10 | Help | 2 | No PIN/QR-ID/CSV help; thin empty-state guidance |

## Specificity verdict
Gym-specific and domain-tuned (duplicate rejection layered client+repo,
Manila day boundaries, membership-state badges, correct CSV). Not a
generic skin. Stronger than the Dashboard's first round (15/40).

## Overall impression
A solid operational core with honest states and correct timezone/money,
undermined by three trust/throughput problems: Enter auto-checks-in the
first search match with no confirmation; a Supabase failure silently swaps
in mock data; Delete and Check-in look identical (both red-underlined
text).

## Priority issues
- P1 Enter auto-checks-in first search match, no confirmation (CheckInsPage.tsx:179-185)
- P1 Silent mock-data fallback on Supabase failure (CheckInsPage.tsx:82-85)
- P1 Delete and Check-in visually identical (buttonClasses primary vs danger)
- P1 QR scanner overlay is not a dialog (QrScanner.tsx:84-103): no role/aria-modal/focus-trap/Escape/focus-restore
- P2 Focus not restored to search after check-in; query not cleared (241-253)
- P2 Tabs not keyboard-operable; no tabpanels (Tabs.tsx)
- P2 No scanning-active indicator in camera overlay (QrScanner.tsx:28-42)
- P2 ~115 lines duplicated member-list markup (396-511)
- P2 Status messages persist indefinitely
- P2 Section titles not headings; loading not role=status; Delete labels ambiguous (no member name)

## Persona red flags
- Alex: Enter shortcut dangerous at a busy counter; focus loss after each
  check-in taxes the repeated cycle; no "N in today" count on the tab.
- Sam: QR overlay is the worst (untrapped, unlabeled); tabs break ARIA;
  delete labels ambiguous.
- Owner: CSV correct but thin (no member ID, no totals); extra Load click.

## Minor observations
recentMembers slice(0,5) but labeled "most recent"; grace copy wordy;
today list shows full datetime; empty CSV export is silent no-op; scanner
150ms poll; processedBy recorded but never surfaced.
