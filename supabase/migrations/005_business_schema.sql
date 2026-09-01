-- Phase 3: full business schema for the gym management system.
-- Entities: membership_plans, members, memberships, invoices, payments,
-- check_ins, classes, class_sessions, class_bookings.
-- Also adds profiles.role (owner | staff | member).

-- ---------------------------------------------------------------------------
-- profiles.role (must exist before auth_role() below references it)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'staff', 'member'));

-- ---------------------------------------------------------------------------
-- Helper: current user's role (NULL when anonymous).
-- Used by RLS policies below so we can write readable role checks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET check_function_args = off
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- membership_plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_plans_select_all ON public.membership_plans
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY membership_plans_insert_staff ON public.membership_plans
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY membership_plans_update_staff ON public.membership_plans
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY membership_plans_delete_owner ON public.membership_plans
  FOR DELETE USING (public.auth_role() = 'owner');

-- ---------------------------------------------------------------------------
-- members (user_id NULL = walk-in without an account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS members_user_id_key ON public.members (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY members_select_staff_or_self ON public.members
  FOR SELECT USING (
    public.auth_role() IN ('owner', 'staff')
    OR user_id = auth.uid()
  );
CREATE POLICY members_insert_staff ON public.members
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY members_update_staff_or_self ON public.members
  FOR UPDATE USING (
    public.auth_role() IN ('owner', 'staff')
    OR user_id = auth.uid()
  ) WITH CHECK (
    public.auth_role() IN ('owner', 'staff')
    OR user_id = auth.uid()
  );
CREATE POLICY members_delete_owner ON public.members
  FOR DELETE USING (public.auth_role() = 'owner');

-- ---------------------------------------------------------------------------
-- memberships (history rows; current one = latest active)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.membership_plans(id) ON DELETE RESTRICT,
  started_at DATE NOT NULL,
  ended_at DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_member_id_idx ON public.memberships (member_id);

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY memberships_select_staff_or_own ON public.memberships
  FOR SELECT USING (
    public.auth_role() IN ('owner', 'staff')
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );
CREATE POLICY memberships_insert_staff ON public.memberships
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY memberships_update_staff ON public.memberships
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY memberships_delete_none ON public.memberships
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL,
  total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_at DATE,
  paid_at DATE,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'paid', 'overdue', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoices_member_id_idx ON public.invoices (member_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_staff_or_own ON public.invoices
  FOR SELECT USING (
    public.auth_role() IN ('owner', 'staff')
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );
CREATE POLICY invoices_insert_staff ON public.invoices
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY invoices_update_staff ON public.invoices
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY invoices_delete_none ON public.invoices
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- payments (record-only; audit trail via processed_by)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'gcash', 'card', 'bank')),
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_member_id_idx ON public.payments (member_id);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON public.payments (invoice_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_staff_or_own ON public.payments
  FOR SELECT USING (
    public.auth_role() IN ('owner', 'staff')
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );
CREATE POLICY payments_insert_staff ON public.payments
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY payments_update_staff ON public.payments
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY payments_delete_none ON public.payments
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- check_ins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  method TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('manual', 'qr')),
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS check_ins_member_id_idx ON public.check_ins (member_id);
CREATE INDEX IF NOT EXISTS check_ins_checked_in_at_idx ON public.check_ins (checked_in_at);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY check_ins_select_staff_or_own ON public.check_ins
  FOR SELECT USING (
    public.auth_role() IN ('owner', 'staff')
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );
CREATE POLICY check_ins_insert_staff ON public.check_ins
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY check_ins_update_none ON public.check_ins
  FOR UPDATE USING (false);
CREATE POLICY check_ins_delete_none ON public.check_ins
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- classes (recurring weekly definition)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER NOT NULL DEFAULT 10 CHECK (capacity > 0),
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL CHECK (end_time > start_time),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY classes_select_all ON public.classes
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY classes_insert_staff ON public.classes
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY classes_update_staff ON public.classes
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY classes_delete_owner ON public.classes
  FOR DELETE USING (public.auth_role() = 'owner');

-- ---------------------------------------------------------------------------
-- class_sessions (materialized occurrences; bookings attach here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  end_time TIME NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_sessions_class_id_idx ON public.class_sessions (class_id);
CREATE INDEX IF NOT EXISTS class_sessions_scheduled_at_idx ON public.class_sessions (scheduled_at);

ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_sessions_select_all ON public.class_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY class_sessions_insert_staff ON public.class_sessions
  FOR INSERT WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY class_sessions_update_staff ON public.class_sessions
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY class_sessions_delete_none ON public.class_sessions
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- class_bookings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'cancelled', 'attended', 'no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, member_id)
);

CREATE INDEX IF NOT EXISTS class_bookings_member_id_idx ON public.class_bookings (member_id);

ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY class_bookings_select_staff_or_own ON public.class_bookings
  FOR SELECT USING (
    public.auth_role() IN ('owner', 'staff')
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );
CREATE POLICY class_bookings_insert_staff_or_own ON public.class_bookings
  FOR INSERT WITH CHECK (
    public.auth_role() IN ('owner', 'staff')
    OR member_id IN (
      SELECT m.id FROM public.members m WHERE m.user_id = auth.uid()
    )
  );
CREATE POLICY class_bookings_update_staff ON public.class_bookings
  FOR UPDATE USING (public.auth_role() IN ('owner', 'staff'))
  WITH CHECK (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY class_bookings_delete_none ON public.class_bookings
  FOR DELETE USING (false);

-- ---------------------------------------------------------------------------
-- Staff/owner visibility of other profiles (for role management).
-- Existing self-only policies from 001_initial_schema.sql still apply.
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT USING (public.auth_role() IN ('owner', 'staff'));
CREATE POLICY profiles_update_role_owner ON public.profiles
  FOR UPDATE USING (public.auth_role() = 'owner')
  WITH CHECK (public.auth_role() = 'owner');