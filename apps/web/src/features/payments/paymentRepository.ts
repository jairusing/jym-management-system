import { mockInvoiceRepository } from './invoiceRepository';
import { mockMemberRepository } from '../members/memberRepository';
import { phDateAfter, phDateInDays, phDateToday } from '../../lib/dates';

export type PaymentMethod = 'cash' | 'gcash' | 'card' | 'bank';

export type Payment = {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  memberId: string;
  memberName: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: string;
  processedBy: string | null;
};

export type PaymentInput = {
  invoiceId: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  amount: number;
  method: PaymentMethod;
  reference: string | null;
};

export interface PaymentRepository {
  listPayments(): Promise<Payment[]>;
  recordPayment(input: PaymentInput): Promise<Payment>;
}

class MockPaymentRepository implements PaymentRepository {
  private payments: Payment[] = [];

  async listPayments() {
    return [...this.payments].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }

  async recordPayment(input: PaymentInput) {
    if (!input.invoiceId) {
      throw new Error('Select an invoice to pay.');
    }
    if (!input.amount || input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }
    const invoice = (await mockInvoiceRepository.listInvoices()).find((candidate) => candidate.id === input.invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found.');
    }
    if (input.amount !== invoice.total) {
      throw new Error(`Payment amount must equal the invoice total (${invoice.total}).`);
    }
    const paidInvoice = await mockInvoiceRepository.markPaid(input.invoiceId);
    const plan = paidInvoice.planId
      ? (await mockInvoiceRepository.listPlans()).find((candidate) => candidate.id === paidInvoice.planId)
      : undefined;
    if (plan) {
      const member = (await mockMemberRepository.listMembers()).find((candidate) => candidate.id === input.memberId);
      const currentEnd = member?.membership?.endsAt;
      const today = phDateToday();
      const endsAt =
        currentEnd && currentEnd > today ? phDateAfter(currentEnd, plan.durationDays) : phDateInDays(plan.durationDays);
      mockMemberRepository.setMembership(input.memberId, {
        planName: plan.name,
        startsAt: today,
        endsAt,
        status: 'active'
      });
    }
    const payment: Payment = {
      id: `payment-${Date.now()}-${this.payments.length}`,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      memberId: input.memberId,
      memberName: input.memberName.trim(),
      amount: input.amount,
      method: input.method,
      reference: input.reference?.trim() || null,
      paidAt: new Date().toISOString(),
      processedBy: 'Front desk'
    };
    this.payments = [payment, ...this.payments];
    return payment;
  }

  reset() {
    this.payments = [];
  }
}

export const mockPaymentRepository = new MockPaymentRepository();