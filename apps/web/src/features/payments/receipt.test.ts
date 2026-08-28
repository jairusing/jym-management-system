import { describe, expect, it } from 'vitest';
import type { Invoice } from './invoiceRepository';
import type { Payment } from './paymentRepository';
import { amountInWords, buildReceipt, receiptFromPayment, type ReceiptSource } from './receipt';

describe('amountInWords', () => {
  it('writes whole pesos', () => {
    expect(amountInWords(1500)).toBe('One Thousand Five Hundred Pesos and 00/100 Only');
    expect(amountInWords(99)).toBe('Ninety-Nine Pesos and 00/100 Only');
    expect(amountInWords(5120)).toBe('Five Thousand One Hundred Twenty Pesos and 00/100 Only');
    expect(amountInWords(750000)).toBe('Seven Hundred Fifty Thousand Pesos and 00/100 Only');
    expect(amountInWords(1000000)).toBe('One Million Pesos and 00/100 Only');
  });

  it('writes centavos', () => {
    expect(amountInWords(99.99)).toBe('Ninety-Nine Pesos and 99/100 Only');
    expect(amountInWords(1234.5)).toBe('One Thousand Two Hundred Thirty-Four Pesos and 50/100 Only');
  });

  it('writes zero', () => {
    expect(amountInWords(0)).toBe('Zero Pesos and 00/100 Only');
  });
});

describe('buildReceipt', () => {
  it('formats money, method and date for the receipt', () => {
    const source: ReceiptSource = {
      invoiceNumber: 'INV-2026-0001',
      memberName: 'Juan Dela Cruz',
      planName: 'Monthly Pass',
      amount: 1500,
      method: 'gcash',
      reference: 'G-12345',
      paidAt: '2026-08-28T09:30:00+08:00',
      takenBy: 'Front desk'
    };

    const receipt = buildReceipt(source);

    expect(receipt.amountLabel).toBe('₱1,500.00');
    expect(receipt.methodLabel).toBe('GCash');
    expect(receipt.amountInWords).toBe('One Thousand Five Hundred Pesos and 00/100 Only');
    expect(receipt.paidAtLabel).toBe('Aug 28, 2026, 9:30:00 AM');
  });
});

describe('receiptFromPayment', () => {
  it('combines the invoice plan with the payment details', () => {
    const invoice: Invoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-2026-0001',
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz',
      total: 1500,
      issuedAt: '2026-08-01T00:00:00+08:00',
      dueAt: null,
      paidAt: '2026-08-28T09:30:00+08:00',
      status: 'paid',
      planId: 'plan-monthly',
      planName: 'Monthly Pass',
      createdAt: '2026-08-01T00:00:00+08:00'
    };
    const payment: Payment = {
      id: 'payment-1',
      invoiceId: 'invoice-1',
      invoiceNumber: 'INV-2026-0001',
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz',
      amount: 1500,
      method: 'cash',
      reference: null,
      paidAt: '2026-08-28T09:30:00+08:00',
      processedBy: 'Maria Staff'
    };

    const source = receiptFromPayment(invoice, payment);

    expect(source.invoiceNumber).toBe('INV-2026-0001');
    expect(source.memberName).toBe('Juan Dela Cruz');
    expect(source.planName).toBe('Monthly Pass');
    expect(source.method).toBe('cash');
    expect(source.takenBy).toBe('Maria Staff');
  });

  it('falls back to the invoice number when the payment has none', () => {
    const invoice: Invoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-2026-0002',
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 800,
      issuedAt: '2026-08-01T00:00:00+08:00',
      dueAt: null,
      paidAt: null,
      status: 'paid',
      planId: null,
      planName: null,
      createdAt: '2026-08-01T00:00:00+08:00'
    };
    const payment: Payment = {
      id: 'payment-2',
      invoiceId: 'invoice-1',
      invoiceNumber: null,
      memberId: 'member-1',
      memberName: 'Maria Santos',
      amount: 800,
      method: 'bank',
      reference: 'B-1',
      paidAt: '2026-08-28T14:00:00+08:00',
      processedBy: null
    };

    const source = receiptFromPayment(invoice, payment);

    expect(source.invoiceNumber).toBe('INV-2026-0002');
    expect(source.takenBy).toBeNull();
  });
});