export type InvoiceStatus = 'issued' | 'paid' | 'overdue' | 'void';

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
  createdAt: string;
};

export type InvoiceInput = {
  memberId: string;
  memberName: string;
  total: number;
  dueAt: string | null;
};

export interface InvoiceRepository {
  listInvoices(): Promise<Invoice[]>;
  createInvoice(input: InvoiceInput): Promise<Invoice>;
  voidInvoice(id: string): Promise<Invoice>;
}

class MockInvoiceRepository implements InvoiceRepository {
  private invoices: Invoice[] = [];

  async listInvoices() {
    return [...this.invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createInvoice(input: InvoiceInput) {
    if (!input.memberId || !input.memberName.trim()) {
      throw new Error('Select a member for the invoice.');
    }
    if (!input.total || input.total <= 0) {
      throw new Error('Invoice total must be greater than zero.');
    }
    const invoice: Invoice = {
      id: `invoice-${Date.now()}-${this.invoices.length}`,
      invoiceNumber: `INV-${Date.now()}`,
      memberId: input.memberId,
      memberName: input.memberName.trim(),
      total: input.total,
      issuedAt: new Date().toISOString().slice(0, 10),
      dueAt: input.dueAt,
      paidAt: null,
      status: 'issued',
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
    if (current.status === 'paid') {
      throw new Error('A paid invoice cannot be voided.');
    }
    const updated: Invoice = { ...current, status: 'void' };
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
    const updated: Invoice = {
      ...current,
      status: 'paid',
      paidAt: new Date().toISOString().slice(0, 10)
    };
    this.invoices = this.invoices.map((invoice) => (invoice.id === id ? updated : invoice));
    return updated;
  }

  reset() {
    this.invoices = [];
  }
}

export const mockInvoiceRepository = new MockInvoiceRepository();