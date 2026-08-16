# Jym Management System — User Flows

Authoritative walkthrough of how the app is used day-to-day by a gym owner,
their staff, and members. Mirrors the implemented product (v1.003).

## Roles

| Role | Powers |
| --- | --- |
| Owner | Everything: members, check-ins, invoices, payments, statements, staff management, member deletion |
| Staff | Everything except staff management and member deletion |
| Member | Sign in, own membership view, own statement, class bookings — database-enforced, cannot record payments or edit their own member row |

## Daily flows

### 1. Sign in
Owner/staff sign in at `/auth` with email + password. Members sign in on their
own phones with the same screen.

### 2. New member walk-in
Members → Add member (name, email/phone, notes; join date defaults to today and
stamps the exact time). The member's row shows **Show QR** — the QR is their
member ID. They save/print it and use it at the counter from then on.

### 3. Check-in (counter, three ways)
- **Scan QR** — camera reads the member's QR code.
- **QR code or member ID** — paste/type the ID.
- **Search by name** — empty search shows the 5 most recent members; typing
  filters to exact matches (name/phone/email).

Blocked before tapping Check in: inactive members (red **Inactive** tag, button
disabled) and expired memberships (red **Expired** tag, button disabled). The
QR path refuses the same cases with a renewal message.

### 4. Selling a membership
Payments → Issue invoice: member, optional plan, total, optional due date.
Record payment (Cash / GCash / Card / Bank + reference) → one database
transaction marks the invoice paid, records the payment, and starts/renews the
membership. No plan = money record only (e.g. PT sessions).

### 5. Renewals and overdue chasing
Payments page summary strip: Outstanding · Collected this month · Overdue
invoices. Status chips (All/Issued/Overdue/Paid/Void) filter the list; every
row links to the member's statement. Void cancels an issued invoice; paid
invoices cannot be voided.

### 6. Member statement
Members → Statement: join date+time, outstanding balance, total paid,
membership periods, invoices (issued/paid times), payments.

### 7. Classes
Sessions with date, time, capacity. Members book online; capacity is enforced
in the database. Cancel/rebook supported.

### 8. Attendance history
Check-ins → Today (latest 10) / History (date range + Load + Export CSV).
Times are stored and shown in Philippine time.

### 9. Staff management (owner only)
Promote/demote staff. Members cannot reach money functions (DB-level, tested).

### 10. Big lists
Members: search + status chips + membership filter + pagination (15/page).
Invoices: status chips with counts + pagination. Payments: pagination.

### 11. Member self-service
My membership (plan, price, dates), Profile (change password). Members see
only their own data.