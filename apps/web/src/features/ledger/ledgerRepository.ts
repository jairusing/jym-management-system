import { type Invoice } from '../payments/invoiceRepository';
import { type Payment } from '../payments/paymentRepository';
import { type Member, type Membership, mockMemberRepository } from '../members/memberRepository';
import { mockInvoiceRepository } from '../payments/invoiceRepository';
import { mockPaymentRepository } from '../payments/paymentRepository';

export type MemberStatement = {
  member: Member;
  memberships: Membership[];
  invoices: Invoice[];
  payments: Payment[];
  outstanding: number;
};

export interface LedgerRepository {
  getMemberStatement(memberId: string): Promise<MemberStatement>;
}

class MockLedgerRepository implements LedgerRepository {
  async getMemberStatement(memberId: string): Promise<MemberStatement> {
    const member = (await mockMemberRepository.listMembers()).find((candidate) => candidate.id === memberId);
    if (!member) {
      throw new Error('Member not found.');
    }
    const invoices = (await mockInvoiceRepository.listInvoices()).filter(
      (invoice) => invoice.memberId === memberId
    );
    const payments = (await mockPaymentRepository.listPayments()).filter(
      (payment) => payment.memberId === memberId
    );
    const outstanding = invoices
      .filter((invoice) => invoice.status === 'issued' || invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + invoice.total, 0);
    return {
      member,
      memberships: mockMemberRepository.listMembershipHistory(memberId),
      invoices,
      payments,
      outstanding
    };
  }
}

export const mockLedgerRepository = new MockLedgerRepository();