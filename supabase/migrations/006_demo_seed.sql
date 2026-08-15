-- Phase 5: demo seed data for the thesis.
-- Data-only inserts into the Phase 3 business schema (005). Runs once via
-- `supabase db push` (each migration is applied exactly once).
-- Processed_by is NULL: no staff account is assumed; the owner/staff account
-- will record real events through the UI.

-- ---------------------------------------------------------------------------
-- membership_plans
-- ---------------------------------------------------------------------------
INSERT INTO public.membership_plans (name, description, price, duration_days, is_active) VALUES
  ('Monthly Pass',    'Unlimited gym access for 30 days',   1200.00,  30, true),
  ('Quarterly Pass',  'Unlimited gym access for 90 days',   3200.00,  90, true),
  ('Annual Pass',     'Unlimited gym access for 365 days', 12000.00, 365, true);

-- ---------------------------------------------------------------------------
-- members (deterministic emails so later inserts can reference them)
-- ---------------------------------------------------------------------------
INSERT INTO public.members (full_name, email, phone, joined_at, notes, is_active) VALUES
  ('Juan Dela Cruz',  'juan.delacruz@demo.jms',  '0917 111 1111', '2026-05-12', 'Regular morning attendee', true),
  ('Maria Santos',    'maria.santos@demo.jms',   '0918 222 2222', '2026-06-01', NULL,                       true),
  ('Pedro Reyes',     'pedro.reyes@demo.jms',   '0919 333 3333', '2026-06-20', 'Prefers evening classes',  true),
  ('Ana Torres',      'ana.torres@demo.jms',    '0920 444 4444', '2026-07-05', NULL,                       true),
  ('Carlo Mendoza',   'carlo.mendoza@demo.jms', '0921 555 5555', '2026-07-18', NULL,                       true),
  ('Liza Fernandez',  'liza.fernandez@demo.jms','0922 666 6666', '2026-08-02', 'Student rate',             true);

-- ---------------------------------------------------------------------------
-- memberships (history rows; current one = latest active)
-- ---------------------------------------------------------------------------
INSERT INTO public.memberships (member_id, plan_id, started_at, ended_at, status)
SELECT m.id, p.id, m.joined_at, NULL, 'active'
FROM public.members m
JOIN public.membership_plans p ON (
  (m.email = 'juan.delacruz@demo.jms'  AND p.name = 'Annual Pass')
  OR (m.email = 'maria.santos@demo.jms'   AND p.name = 'Quarterly Pass')
  OR (m.email = 'pedro.reyes@demo.jms'   AND p.name = 'Monthly Pass')
  OR (m.email = 'ana.torres@demo.jms'    AND p.name = 'Monthly Pass')
  OR (m.email = 'carlo.mendoza@demo.jms' AND p.name = 'Quarterly Pass')
  OR (m.email = 'liza.fernandez@demo.jms'AND p.name = 'Monthly Pass')
);

INSERT INTO public.memberships (member_id, plan_id, started_at, ended_at, status)
SELECT m.id, p.id, '2026-06-20', '2026-07-20', 'expired'
FROM public.members m
JOIN public.membership_plans p ON p.name = 'Monthly Pass'
WHERE m.email = 'pedro.reyes@demo.jms';

-- ---------------------------------------------------------------------------
-- check_ins (last 7 days so the dashboard week bars show activity)
-- ---------------------------------------------------------------------------
INSERT INTO public.check_ins (member_id, checked_in_at, method, processed_by)
SELECT m.id, now() - interval '2 hours', 'manual', NULL::uuid FROM public.members m WHERE m.email = 'juan.delacruz@demo.jms'
UNION ALL
SELECT m.id, now() - interval '3 hours', 'manual', NULL FROM public.members m WHERE m.email = 'maria.santos@demo.jms'
UNION ALL
SELECT m.id, now() - interval '5 hours', 'manual', NULL FROM public.members m WHERE m.email = 'pedro.reyes@demo.jms'
UNION ALL
SELECT m.id, now() - interval '1 day',   'manual', NULL FROM public.members m WHERE m.email = 'ana.torres@demo.jms'
UNION ALL
SELECT m.id, now() - interval '1 day',   'manual', NULL FROM public.members m WHERE m.email = 'carlo.mendoza@demo.jms'
UNION ALL
SELECT m.id, now() - interval '2 days',  'manual', NULL FROM public.members m WHERE m.email = 'liza.fernandez@demo.jms'
UNION ALL
SELECT m.id, now() - interval '2 days',  'manual', NULL FROM public.members m WHERE m.email = 'juan.delacruz@demo.jms'
UNION ALL
SELECT m.id, now() - interval '3 days',  'manual', NULL FROM public.members m WHERE m.email = 'maria.santos@demo.jms'
UNION ALL
SELECT m.id, now() - interval '4 days',  'manual', NULL FROM public.members m WHERE m.email = 'pedro.reyes@demo.jms'
UNION ALL
SELECT m.id, now() - interval '5 days',  'manual', NULL FROM public.members m WHERE m.email = 'ana.torres@demo.jms'
UNION ALL
SELECT m.id, now() - interval '6 days',  'manual', NULL FROM public.members m WHERE m.email = 'carlo.mendoza@demo.jms'
UNION ALL
SELECT m.id, now() - interval '6 days',  'manual', NULL FROM public.members m WHERE m.email = 'liza.fernandez@demo.jms';

-- ---------------------------------------------------------------------------
-- classes (recurring weekly definitions; 0 = Mon .. 6 = Sun)
-- ---------------------------------------------------------------------------
INSERT INTO public.classes (name, description, capacity, trainer_id, day_of_week, start_time, end_time, is_active) VALUES
  ('Sunrise Yoga',     'Gentle flow to start the day',        12, NULL, 0, '06:30', '07:30', true),
  ('HIIT Burn',        'High-intensity interval training',    15, NULL, 2, '18:00', '19:00', true),
  ('Strength Basics',  'Barbell and dumbbell fundamentals',   10, NULL, 4, '17:00', '18:30', true);

-- ---------------------------------------------------------------------------
-- class_sessions (materialized for the current week, Monday start)
-- ---------------------------------------------------------------------------
INSERT INTO public.class_sessions (class_id, scheduled_at, end_time, capacity, trainer_id, status)
SELECT c.id, date_trunc('week', now())::date + time '06:30', '07:30', c.capacity, NULL, 'scheduled'
FROM public.classes c WHERE c.name = 'Sunrise Yoga';

INSERT INTO public.class_sessions (class_id, scheduled_at, end_time, capacity, trainer_id, status)
SELECT c.id, date_trunc('week', now())::date + time '18:00', '19:00', c.capacity, NULL, 'scheduled'
FROM public.classes c WHERE c.name = 'HIIT Burn';

INSERT INTO public.class_sessions (class_id, scheduled_at, end_time, capacity, trainer_id, status)
SELECT c.id, date_trunc('week', now())::date + time '17:00', '18:30', c.capacity, NULL, 'scheduled'
FROM public.classes c WHERE c.name = 'Strength Basics';

-- ---------------------------------------------------------------------------
-- class_bookings
-- ---------------------------------------------------------------------------
INSERT INTO public.class_bookings (session_id, member_id, booked_at, status)
SELECT cs.id, m.id, now() - interval '1 day', 'booked'
FROM public.class_sessions cs
JOIN public.classes c ON c.id = cs.class_id
JOIN public.members m ON m.email = 'maria.santos@demo.jms'
WHERE c.name = 'Sunrise Yoga' AND cs.scheduled_at >= date_trunc('week', now());

INSERT INTO public.class_bookings (session_id, member_id, booked_at, status)
SELECT cs.id, m.id, now() - interval '2 days', 'booked'
FROM public.class_sessions cs
JOIN public.classes c ON c.id = cs.class_id
JOIN public.members m ON m.email = 'juan.delacruz@demo.jms'
WHERE c.name = 'HIIT Burn' AND cs.scheduled_at >= date_trunc('week', now());

INSERT INTO public.class_bookings (session_id, member_id, booked_at, status)
SELECT cs.id, m.id, now() - interval '2 days', 'booked'
FROM public.class_sessions cs
JOIN public.classes c ON c.id = cs.class_id
JOIN public.members m ON m.email = 'ana.torres@demo.jms'
WHERE c.name = 'HIIT Burn' AND cs.scheduled_at >= date_trunc('week', now());

INSERT INTO public.class_bookings (session_id, member_id, booked_at, status)
SELECT cs.id, m.id, now() - interval '3 days', 'booked'
FROM public.class_sessions cs
JOIN public.classes c ON c.id = cs.class_id
JOIN public.members m ON m.email = 'carlo.mendoza@demo.jms'
WHERE c.name = 'Strength Basics' AND cs.scheduled_at >= date_trunc('week', now());

INSERT INTO public.class_bookings (session_id, member_id, booked_at, status)
SELECT cs.id, m.id, now() - interval '4 days', 'cancelled'
FROM public.class_sessions cs
JOIN public.classes c ON c.id = cs.class_id
JOIN public.members m ON m.email = 'liza.fernandez@demo.jms'
WHERE c.name = 'Sunrise Yoga' AND cs.scheduled_at >= date_trunc('week', now());

-- ---------------------------------------------------------------------------
-- invoices (one paid, one current, one overdue-by-date)
-- ---------------------------------------------------------------------------
INSERT INTO public.invoices (invoice_number, member_id, membership_id, total, issued_at, due_at, paid_at, status) VALUES
  ('INV-2026-0001', (SELECT id FROM public.members WHERE email = 'maria.santos@demo.jms'),  NULL, 3200.00, '2026-08-01', '2026-08-31', NULL, 'issued'),
  ('INV-2026-0002', (SELECT id FROM public.members WHERE email = 'carlo.mendoza@demo.jms'), NULL, 1200.00, '2026-07-18', '2026-07-25', NULL, 'issued'),
  ('INV-2026-0003', (SELECT id FROM public.members WHERE email = 'liza.fernandez@demo.jms'),NULL, 1200.00, '2026-08-02', '2026-08-16', '2026-08-02', 'paid');

-- ---------------------------------------------------------------------------
-- payments (record-only; processed_by NULL for seed data)
-- ---------------------------------------------------------------------------
INSERT INTO public.payments (invoice_id, member_id, amount, method, reference, paid_at, processed_by) VALUES
  ((SELECT id FROM public.invoices WHERE invoice_number = 'INV-2026-0003'),
   (SELECT id FROM public.members WHERE email = 'liza.fernandez@demo.jms'),
   1200.00, 'gcash', 'GC-8821', '2026-08-02 09:15:00+08', NULL);