import { mockInvoiceRepository } from './invoiceRepository';
import { mockMemberRepository } from '../members/memberRepository';

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
    const paidInvoice = await mockInvoiceRepository.markPaid(input.invoiceId);
    const plan = paidInvoice.planId
      ? (await mockInvoiceRepository.listPlans()).find((candidate) => candidate.id === paidInvoice.planId)
      : undefined;
    if (plan) {
      const end = new Date();
      end.setDate(end.getDate() + plan.durationDays);
      mockMemberRepository.setMembership(input.memberId, {
        planName: plan.name,
        startsAt: new Date().toISOString().slice(0, 10),
        endsAt: end.toISOString().slice(0, 10)
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
      processedBy: null
    };
    this.payments = [payment, ...this.payments];
    return payment;
  }

  reset() {
    this.payments = [];
  }
}

export const mockPaymentRepository = new MockPaymentRepository();