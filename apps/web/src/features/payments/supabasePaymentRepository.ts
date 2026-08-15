import { supabase } from '../../lib/supabase';
import { phDateInDays, phDateToday } from '../../lib/dates';
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
};

const paymentColumns =
  'id, invoice_id, member_id, amount, method, reference, paid_at, processed_by, created_at, members(full_name), invoices(invoice_number)';

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
    processedBy: row.processed_by
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

    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      throw new Error('Failed to identify signed-in user: no active session.');
    }

    const { data, error } = await client
      .from('payments')
      .insert({
        invoice_id: input.invoiceId,
        member_id: input.memberId,
        amount: input.amount,
        method: input.method,
        reference: input.reference?.trim() || null,
        processed_by: userId
      })
      .select(paymentColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to record payment: ${error?.message ?? 'unknown'}`);
    }

    const { error: invoiceError } = await client
      .from('invoices')
      .update({ status: 'paid', paid_at: phDateToday() })
      .eq('id', input.invoiceId);
    if (invoiceError) {
      throw new Error(`Payment recorded but invoice not marked paid: ${invoiceError.message}`);
    }

    const { data: invoiceData, error: planError } = await client
      .from('invoices')
      .select('plan_id, membership_plans(duration_days)')
      .eq('id', input.invoiceId)
      .single();
    if (planError || !invoiceData) {
      throw new Error(`Payment recorded but plan lookup failed: ${planError?.message ?? 'unknown'}`);
    }
    const plan = invoiceData.plan_id
      ? (Array.isArray(invoiceData.membership_plans) ? invoiceData.membership_plans[0] : invoiceData.membership_plans)
      : null;
    if (invoiceData.plan_id && plan) {
      const startedAt = phDateToday();

      const { error: expireError } = await client
        .from('memberships')
        .update({ status: 'expired' })
        .eq('member_id', input.memberId)
        .eq('status', 'active');
      if (expireError) {
        throw new Error(`Payment recorded but memberships not expired: ${expireError.message}`);
      }

      const { error: insertError } = await client.from('memberships').insert({
        member_id: input.memberId,
        plan_id: invoiceData.plan_id,
        started_at: startedAt,
        ended_at: phDateInDays(plan.duration_days),
        status: 'active'
      });
      if (insertError) {
        throw new Error(`Payment recorded but membership not created: ${insertError.message}`);
      }
    }

    return mapPayment(data as PaymentRow);
  }
}