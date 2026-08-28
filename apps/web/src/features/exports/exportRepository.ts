import { type CheckIn } from '../checkins/checkInRepository';
import { mockCheckInRepository } from '../checkins/checkInRepository';
import { type Member } from '../members/memberRepository';
import { mockMemberRepository } from '../members/memberRepository';
import { type Invoice } from '../payments/invoiceRepository';
import { mockInvoiceRepository } from '../payments/invoiceRepository';
import { type Payment } from '../payments/paymentRepository';
import { mockPaymentRepository } from '../payments/paymentRepository';

export type MemberExportRow = {
  memberId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  isActive: boolean;
  planName: string | null;
  membershipStatus: string | null;
  membershipEndsAt: string | null;
};

export type InvoiceExportRow = {
  invoiceNumber: string;
  memberName: string;
  total: number;
  status: string;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
};

export type PaymentExportRow = {
  invoiceNumber: string | null;
  memberName: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  processedBy: string | null;
};

export type BackupPayload = {
  exportedAt: string;
  members: MemberExportRow[];
  invoices: InvoiceExportRow[];
  payments: PaymentExportRow[];
  checkIns: CheckIn[];
};

export type ExportSection = 'members' | 'invoices' | 'payments' | 'attendance' | 'backup';

export interface ExportRepository {
  listMembersForExport(): Promise<MemberExportRow[]>;
  listInvoicesForExport(): Promise<InvoiceExportRow[]>;
  listPaymentsForExport(): Promise<PaymentExportRow[]>;
  listCheckInsForExport(from: string, to: string): Promise<CheckIn[]>;
  getBackup(): Promise<BackupPayload>;
}

export function toMemberExportRow(member: Member): MemberExportRow {
  return {
    memberId: member.id,
    fullName: member.fullName,
    email: member.email,
    phone: member.phone,
    joinedAt: member.joinedAt,
    isActive: member.isActive,
    planName: member.membership?.planName ?? null,
    membershipStatus: member.membership?.status ?? null,
    membershipEndsAt: member.membership?.endsAt ?? null
  };
}

export function toInvoiceExportRow(invoice: Invoice): InvoiceExportRow {
  return {
    invoiceNumber: invoice.invoiceNumber,
    memberName: invoice.memberName,
    total: invoice.total,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt
  };
}

export function toPaymentExportRow(payment: Payment): PaymentExportRow {
  return {
    invoiceNumber: payment.invoiceNumber,
    memberName: payment.memberName,
    amount: payment.amount,
    method: payment.method,
    reference: payment.reference,
    paidAt: payment.paidAt,
    processedBy: payment.processedBy
  };
}

class MockExportRepository implements ExportRepository {
  private failures: ExportSection[] = [];

  private failIf(section: ExportSection) {
    if (this.failures.includes(section)) {
      throw new Error('Export failed on purpose.');
    }
  }

  async listMembersForExport() {
    this.failIf('members');
    const members = await mockMemberRepository.listMembers();
    return members.map(toMemberExportRow);
  }

  async listInvoicesForExport() {
    this.failIf('invoices');
    const invoices = await mockInvoiceRepository.listInvoices();
    return invoices.map(toInvoiceExportRow);
  }

  async listPaymentsForExport() {
    this.failIf('payments');
    const payments = await mockPaymentRepository.listPayments();
    return payments.map(toPaymentExportRow);
  }

  async listCheckInsForExport(from: string, to: string) {
    this.failIf('attendance');
    return mockCheckInRepository.listCheckIns(from, to);
  }

  async getBackup() {
    this.failIf('backup');
    const [members, invoices, payments, checkIns] = await Promise.all([
      this.listMembersForExport(),
      this.listInvoicesForExport(),
      this.listPaymentsForExport(),
      mockCheckInRepository.listCheckIns('1970-01-01T00:00:00.000Z', '2999-12-31T23:59:59.999Z')
    ]);
    return {
      exportedAt: new Date().toISOString(),
      members,
      invoices,
      payments,
      checkIns
    };
  }

  setFailures(sections: ExportSection[]) {
    this.failures = [...sections];
  }

  reset() {
    this.failures = [];
  }
}

export const mockExportRepository = new MockExportRepository();