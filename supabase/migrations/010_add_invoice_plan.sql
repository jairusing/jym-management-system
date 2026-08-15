-- invoices may reference a membership plan so a payment can renew membership
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.membership_plans(id) ON DELETE SET NULL;