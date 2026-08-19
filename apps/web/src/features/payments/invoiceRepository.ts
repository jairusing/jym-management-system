export type InvoiceStatus = 'issued' | 'paid' | 'overdue' | 'void';

import { PH_TIME_ZONE } from '../../lib/dates';
import { mockPaymentRepository } from './paymentRepository';

export type Plan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  isActive: boolean;
};

export type Invoice = {
  id: string;
  invoiceNumber: string;
  memberId: string;
  memberName: string;
  total: number;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  status: InvoiceStatus;
  planId: string | null;
  planName: string | null;
  createdAt: string;
};

export type InvoiceInput = {
  memberId: string;
  memberName: string;
  total: number;
  dueAt: string | null;
  planId?: string | null;
};

export interface InvoiceRepository {
  listInvoices(): Promise<Invoice[]>;
  listPlans(): Promise<Plan[]>;
  createInvoice(input: InvoiceInput): Promise<Invoice>;
  voidInvoice(id: string): Promise<Invoice>;
}

class MockInvoiceRepository implements InvoiceRepository {
  private invoices: Invoice[] = [];
  private invoiceCounter = 0;

  private plans: Plan[] = [
    { id: 'plan-monthly', name: 'Monthly Pass', description: null, price: 1500, durationDays: 30, isActive: true },
    { id: 'plan-quarterly', name: 'Quarterly Pass', description: null, price: 4000, durationDays: 90, isActive: true },
    { id: 'plan-annual', name: 'Annual Pass', description: null, price: 12000, durationDays: 365, isActive: true }
  ];

  async listInvoices() {
    return [...this.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listPlans() {
    return [...this.plans];
  }

  async createInvoice(input: InvoiceInput) {
    if (!input.memberId || !input.memberName.trim()) {
      throw new Error('Select a member for the invoice.');
    }
    if (!input.total || input.total <= 0) {
      throw new Error('Invoice total must be greater than zero.');
    }
    const plan = this.plans.find((candidate) => candidate.id === input.planId) ?? null;
    this.invoiceCounter += 1;
    const year = new Intl.DateTimeFormat('en-CA', { timeZone: PH_TIME_ZONE, year: 'numeric' }).format(new Date());
    const invoice: Invoice = {
      id: `invoice-${Date.now()}-${this.invoices.length}`,
      invoiceNumber: `INV-${year}-${String(this.invoiceCounter).padStart(4, '0')}`,
      memberId: input.memberId,
      memberName: input.memberName.trim(),
      total: input.total,
      issuedAt: new Date().toISOString(),
      dueAt: input.dueAt,
      paidAt: null,
      status: 'issued',
      planId: plan?.id ?? null,
      planName: plan?.name ?? null,
      createdAt: new Date().toISOString()
    };
    this.invoices = [invoice, ...this.invoices];
    return invoice;
  }

  async voidInvoice(id: string) {
    const index = this.invoices.findIndex((invoice) => invoice.id === id);
    if (index === -1) {
      throw new Error('Invoice not found.');
    }
    const current = this.invoices[index];
    if (!current) {
      throw new Error('Invoice not found.');
    }
    if (current.status === 'void') {
      throw new Error('Invoice is already void.');
    }
    let updated: Invoice;
    if (current.status === 'paid') {
      mockPaymentRepository.removePaymentsForInvoice(id);
      updated = { ...current, status: 'issued', paidAt: null };
    } else {
      updated = { ...current, status: 'void' };
    }
    this.invoices = this.invoices.map((invoice) => (invoice.id === id ? updated : invoice));
    return updated;
  }

  async markPaid(id: string) {
    const index = this.invoices.findIndex((invoice) => invoice.id === id);
    if (index === -1) {
      throw new Error('Invoice not found.');
    }
    const current = this.invoices[index];
    if (!current) {
      throw new Error('Invoice not found.');
    }
    if (current.status !== 'issued') {
      throw new Error('Invoice is not payable.');
    }
    const updated: Invoice = {
      ...current,
      status: 'paid',
      paidAt: new Date().toISOString()
    };
    this.invoices = this.invoices.map((invoice) => (invoice.id === id ? updated : invoice));
    return updated;
  }

  reset() {
    this.invoices = [];
  }
}

export const mockInvoiceRepository = new MockInvoiceRepository();