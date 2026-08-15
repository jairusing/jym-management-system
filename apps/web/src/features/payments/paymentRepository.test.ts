import { afterEach, describe, expect, it } from 'vitest';
import { mockInvoiceRepository } from './invoiceRepository';
import { mockPaymentRepository } from './paymentRepository';

afterEach(() => {
  mockPaymentRepository.reset();
  mockInvoiceRepository.reset();
});

describe('mockPaymentRepository', () => {
  it('rejects a second payment for the same invoice', async () => {
    const invoice = await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Ana',
      total: 1500,
      dueAt: null,
      planId: 'plan-monthly'
    });
    const input = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: 'member-1',
      memberName: 'Ana',
      amount: 1500,
      method: 'cash' as const,
      reference: null
    };

    await mockPaymentRepository.recordPayment(input);
    await expect(mockPaymentRepository.recordPayment(input)).rejects.toThrow('Invoice is not payable.');
  });

  it('rejects a payment for a voided invoice', async () => {
    const invoice = await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Ana',
      total: 1500,
      dueAt: null
    });
    await mockInvoiceRepository.voidInvoice(invoice.id);

    await expect(
      mockPaymentRepository.recordPayment({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        memberId: 'member-1',
        memberName: 'Ana',
        amount: 1500,
        method: 'cash',
        reference: null
      })
    ).rejects.toThrow('Invoice is not payable.');
  });
});