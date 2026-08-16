import { supabase } from '../../lib/supabase';
import {
  type Member,
  type Membership,
  type MembershipStatus
} from '../members/memberRepository';
import { type Invoice, type InvoiceStatus } from '../payments/invoiceRepository';
import { type Payment, type PaymentMethod } from '../payments/paymentRepository';
import { type MemberStatement } from './ledgerRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type MemberRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  joined_at: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export class SupabaseLedgerRepository {
  async getMemberStatement(memberId: string): Promise<MemberStatement> {
    const client = ensureSupabase();

    const [memberResult, membershipsResult, invoicesResult, paymentsResult] = await Promise.all([
      client
        .from('members')
        .select(
          'id, user_id, full_name, email, phone, joined_at, notes, is_active, created_at'
        )
        .eq('id', memberId)
        .maybeSingle(),
      client
        .from('memberships')
        .select('status, started_at, ended_at, membership_plans(name)')
        .eq('member_id', memberId)
        .order('started_at', { ascending: false }),
      client
        .from('invoices')
        .select(
          'id, invoice_number, member_id, total, issued_at, due_at, paid_at, status, is_overdue, plan_id, created_at, membership_plans(name)'
        )
        .eq('member_id', memberId)
        .order('created_at', { ascending: false }),
      client
        .from('payments')
        .select(
          'id, invoice_id, member_id, amount, method, reference, paid_at, processed_by, created_at, invoices(invoice_number)'
        )
        .eq('member_id', memberId)
        .order('paid_at', { ascending: false })
    ]);

    if (memberResult.error) {
      throw new Error(`Failed to load member: ${memberResult.error.message}`);
    }
    if (!memberResult.data) {
      throw new Error('Member not found.');
    }
    if (membershipsResult.error) {
      throw new Error(`Failed to load memberships: ${membershipsResult.error.message}`);
    }
    if (invoicesResult.error) {
      throw new Error(`Failed to load invoices: ${invoicesResult.error.message}`);
    }
    if (paymentsResult.error) {
      throw new Error(`Failed to load payments: ${paymentsResult.error.message}`);
    }

    const memberRow = memberResult.data as MemberRow;
    const member: Member = {
      id: memberRow.id,
      userId: memberRow.user_id,
      fullName: memberRow.full_name,
      email: memberRow.email,
      phone: memberRow.phone,
      joinedAt: memberRow.joined_at,
      notes: memberRow.notes,
      isActive: memberRow.is_active,
      membership: null,
      createdAt: memberRow.created_at
    };

    const memberships: Membership[] = (membershipsResult.data ?? []).map((row) => ({
      planName: (Array.isArray(row.membership_plans) ? row.membership_plans[0] : row.membership_plans)
        ?.name ?? 'Unknown plan',
      startsAt: row.started_at,
      endsAt: row.ended_at ?? row.started_at,
      status: row.status as MembershipStatus
    }));

    const invoices: Invoice[] = (invoicesResult.data ?? []).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      memberId: row.member_id,
      memberName: '',
      total: row.total,
      issuedAt: row.issued_at,
      dueAt: row.due_at,
      paidAt: row.paid_at,
      status: row.status === 'issued' && row.is_overdue ? 'overdue' : (row.status as InvoiceStatus),
      planId: row.plan_id,
      planName:
        (Array.isArray(row.membership_plans) ? row.membership_plans[0] : row.membership_plans)?.name ??
        null,
      createdAt: row.created_at
    }));

    const payments: Payment[] = (paymentsResult.data ?? []).map((row) => ({
      id: row.id,
      invoiceId: row.invoice_id,
      invoiceNumber:
        (Array.isArray(row.invoices) ? row.invoices[0] : row.invoices)?.invoice_number ?? null,
      memberId: row.member_id,
      memberName: '',
      amount: row.amount,
      method: row.method as PaymentMethod,
      reference: row.reference,
      paidAt: row.paid_at,
      processedBy: row.processed_by
    }));

    const outstanding = invoices
      .filter((invoice) => invoice.status === 'issued' || invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + invoice.total, 0);

    return { member, memberships, invoices, payments, outstanding };
  }
}