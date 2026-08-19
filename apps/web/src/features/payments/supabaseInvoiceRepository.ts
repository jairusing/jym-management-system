import { supabase } from '../../lib/supabase';
import { type Invoice, type InvoiceInput, type InvoiceStatus, type Plan } from './invoiceRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  member_id: string;
  total: number;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  status: InvoiceStatus;
  is_overdue: boolean;
  plan_id: string | null;
  created_at: string;
  members: { full_name: string } | { full_name: string }[] | null;
  membership_plans: { name: string } | { name: string }[] | null;
};

const invoiceColumns =
  'id, invoice_number, member_id, total, issued_at, due_at, paid_at, status, is_overdue, plan_id, created_at, members(full_name), membership_plans(name)';

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    memberId: row.member_id,
    memberName: (Array.isArray(row.members) ? row.members[0] : row.members)?.full_name ?? 'Unknown member',
    total: row.total,
    issuedAt: row.issued_at,
    dueAt: row.due_at,
    paidAt: row.paid_at,
    status: row.status === 'issued' && row.is_overdue ? 'overdue' : row.status,
    planId: row.plan_id,
    planName: (Array.isArray(row.membership_plans) ? row.membership_plans[0] : row.membership_plans)?.name ?? null,
    createdAt: row.created_at
  };
}

type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  is_active: boolean;
};

function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    durationDays: row.duration_days,
    isActive: row.is_active
  };
}

export class SupabaseInvoiceRepository {
  async listInvoices(): Promise<Invoice[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('invoices')
      .select(invoiceColumns)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load invoices: ${error.message}`);
    }

    return (data ?? []).map((row) => mapInvoice(row as InvoiceRow));
  }

  async listPlans(): Promise<Plan[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('membership_plans')
      .select('id, name, description, price, duration_days, is_active')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) {
      throw new Error(`Failed to load plans: ${error.message}`);
    }

    return (data ?? []).map((row) => mapPlan(row as PlanRow));
  }

  async createInvoice(input: InvoiceInput): Promise<Invoice> {
    const client = ensureSupabase();

    if (!input.memberId) {
      throw new Error('Select a member for the invoice.');
    }
    if (!input.total || input.total <= 0) {
      throw new Error('Invoice total must be greater than zero.');
    }

    const { data, error } = await client
      .from('invoices')
      .insert({
        member_id: input.memberId,
        total: input.total,
        due_at: input.dueAt,
        plan_id: input.planId ?? null
      })
      .select(invoiceColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to create invoice: ${error?.message ?? 'unknown'}`);
    }

    return mapInvoice(data as InvoiceRow);
  }

  async voidInvoice(id: string): Promise<Invoice> {
    const client = ensureSupabase();

    const { data, error } = await client.rpc('rpc_void_invoice', { p_invoice_id: id }).single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to void invoice.');
    }

    return mapInvoice(data as InvoiceRow);
  }
}