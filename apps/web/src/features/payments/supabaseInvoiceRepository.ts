import { supabase } from '../../lib/supabase';
import { type Invoice, type InvoiceInput, type InvoiceStatus } from './invoiceRepository';

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
  created_at: string;
  members: { full_name: string } | { full_name: string }[] | null;
};

const invoiceColumns =
  'id, invoice_number, member_id, total, issued_at, due_at, paid_at, status, created_at, members(full_name)';

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
    status: row.status,
    createdAt: row.created_at
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
        invoice_number: `INV-${Date.now()}`,
        member_id: input.memberId,
        total: input.total,
        due_at: input.dueAt
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

    const { data, error } = await client
      .from('invoices')
      .update({ status: 'void' })
      .eq('id', id)
      .select(invoiceColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to void invoice: ${error?.message ?? 'unknown'}`);
    }

    return mapInvoice(data as InvoiceRow);
  }
}