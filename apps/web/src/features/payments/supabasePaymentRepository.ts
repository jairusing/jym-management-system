import { supabase } from '../../lib/supabase';
import { type Payment, type PaymentInput, type PaymentMethod } from './paymentRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type PaymentRow = {
  id: string;
  invoice_id: string | null;
  member_id: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paid_at: string;
  processed_by: string | null;
  created_at: string;
  members: { full_name: string } | { full_name: string }[] | null;
  invoices: { invoice_number: string } | { invoice_number: string }[] | null;
  profiles: { name: string } | { name: string }[] | null;
};

const paymentColumns =
  'id, invoice_id, member_id, amount, method, reference, paid_at, processed_by, created_at, members(full_name), invoices(invoice_number), profiles(name)';

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    invoiceNumber: (Array.isArray(row.invoices) ? row.invoices[0] : row.invoices)?.invoice_number ?? null,
    memberId: row.member_id,
    memberName: (Array.isArray(row.members) ? row.members[0] : row.members)?.full_name ?? 'Unknown member',
    amount: row.amount,
    method: row.method,
    reference: row.reference,
    paidAt: row.paid_at,
    processedBy: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.name ?? null
  };
}

export class SupabasePaymentRepository {
  async listPayments(): Promise<Payment[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('payments')
      .select(paymentColumns)
      .order('paid_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load payments: ${error.message}`);
    }

    return (data ?? []).map((row) => mapPayment(row as PaymentRow));
  }

  async recordPayment(input: PaymentInput): Promise<Payment> {
    const client = ensureSupabase();

    if (!input.invoiceId) {
      throw new Error('Select an invoice to pay.');
    }
    if (!input.amount || input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const { data, error } = await client.rpc('rpc_record_payment', {
      p_invoice_id: input.invoiceId,
      p_member_id: input.memberId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference?.trim() || null,
      p_paid_at: new Date().toISOString()
    });

    if (error) {
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    const paymentId = (data as { id?: string } | null)?.id;
    const { data: paymentData, error: loadError } = await client
      .from('payments')
      .select(paymentColumns)
      .eq('id', paymentId as string)
      .single();

    if (loadError || !paymentData) {
      throw new Error(`Payment recorded but failed to load: ${loadError?.message ?? 'unknown'}`);
    }

    return mapPayment(paymentData as PaymentRow);
  }
}