import { supabase } from '../../lib/supabase';
import { type CheckIn } from '../checkins/checkInRepository';
import {
  type BackupPayload,
  type ExportRepository,
  type InvoiceExportRow,
  type MemberExportRow,
  type PaymentExportRow
} from './exportRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type NameTuple = { name: string } | { name: string }[] | null;
type FullNameTuple = { full_name: string } | { full_name: string }[] | null;
type InvoiceNumberTuple = { invoice_number: string } | { invoice_number: string }[] | null;

function firstName(value: NameTuple) {
  return (Array.isArray(value) ? value[0] : value)?.name ?? null;
}

function firstFullName(value: FullNameTuple) {
  return (Array.isArray(value) ? value[0] : value)?.full_name ?? null;
}

function firstInvoiceNumber(value: InvoiceNumberTuple) {
  return (Array.isArray(value) ? value[0] : value)?.invoice_number ?? null;
}

type MemberRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  joined_at: string;
  is_active: boolean;
  memberships:
    | {
        status: string;
        started_at: string;
        ended_at: string | null;
        membership_plans: { name: string } | { name: string }[] | null;
      }[]
    | null;
};

const memberColumns =
  'id, full_name, email, phone, joined_at, is_active, memberships(status, started_at, ended_at, membership_plans(name))';

function mapMemberRow(row: MemberRow): MemberExportRow {
  const latest = [...(row.memberships ?? [])].sort(
    (a, b) => b.started_at.localeCompare(a.started_at)
  )[0];
  return {
    memberId: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.joined_at,
    isActive: row.is_active,
    planName: firstName(latest?.membership_plans ?? null) ?? null,
    membershipStatus: latest?.status ?? null,
    membershipEndsAt: latest?.ended_at ?? null
  };
}

type InvoiceRow = {
  invoice_number: string;
  members: FullNameTuple;
  total: number;
  status: string;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
};

const invoiceColumns =
  'invoice_number, member_id, total, issued_at, due_at, paid_at, status, members(full_name)';

function mapInvoiceRow(row: InvoiceRow): InvoiceExportRow {
  return {
    invoiceNumber: row.invoice_number,
    memberName: firstFullName(row.members) ?? 'Unknown member',
    total: row.total,
    status: row.status,
    issuedAt: row.issued_at,
    dueAt: row.due_at,
    paidAt: row.paid_at
  };
}

type PaymentRow = {
  members: FullNameTuple;
  invoices: InvoiceNumberTuple;
  amount: number;
  method: string;
  reference: string | null;
  paid_at: string;
  profiles: NameTuple;
};

const paymentColumns =
  'member_id, amount, method, reference, paid_at, processed_by, members(full_name), invoices(invoice_number), profiles(name)';

function mapPaymentRow(row: PaymentRow): PaymentExportRow {
  return {
    invoiceNumber: firstInvoiceNumber(row.invoices),
    memberName: firstFullName(row.members) ?? 'Unknown member',
    amount: row.amount,
    method: row.method,
    reference: row.reference,
    paidAt: row.paid_at,
    processedBy: firstName(row.profiles)
  };
}

type CheckInRow = {
  id: string;
  member_id: string;
  checked_in_at: string;
  method: 'manual' | 'qr';
  processed_by: string | null;
  members: FullNameTuple;
};

function mapCheckInRow(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: firstFullName(row.members) ?? 'Unknown member',
    checkedInAt: row.checked_in_at,
    method: row.method,
    processedBy: row.processed_by
  };
}

const checkInColumns = 'id, member_id, checked_in_at, method, processed_by, members(full_name)';

export class SupabaseExportRepository implements ExportRepository {
  async listMembersForExport(): Promise<MemberExportRow[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('members')
      .select(memberColumns)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load members for export: ${error.message}`);
    }

    return (data ?? []).map((row) => mapMemberRow(row as MemberRow));
  }

  async listInvoicesForExport(): Promise<InvoiceExportRow[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('invoices')
      .select(invoiceColumns)
      .order('issued_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load invoices for export: ${error.message}`);
    }

    return (data ?? []).map((row) => mapInvoiceRow(row as InvoiceRow));
  }

  async listPaymentsForExport(): Promise<PaymentExportRow[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('payments')
      .select(paymentColumns)
      .order('paid_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load payments for export: ${error.message}`);
    }

    return (data ?? []).map((row) => mapPaymentRow(row as PaymentRow));
  }

  async listCheckInsForExport(from: string, to: string): Promise<CheckIn[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('check_ins')
      .select(checkInColumns)
      .gte('checked_in_at', from)
      .lte('checked_in_at', to)
      .order('checked_in_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load check-ins for export: ${error.message}`);
    }

    return (data ?? []).map((row) => mapCheckInRow(row as CheckInRow));
  }

  async getBackup(): Promise<BackupPayload> {
    const [members, invoices, payments, checkIns] = await Promise.all([
      this.listMembersForExport(),
      this.listInvoicesForExport(),
      this.listPaymentsForExport(),
      this.listCheckInsForExport('1970-01-01T00:00:00.000Z', '2999-12-31T23:59:59.999Z')
    ]);

    return {
      exportedAt: new Date().toISOString(),
      members,
      invoices,
      payments,
      checkIns
    };
  }
}