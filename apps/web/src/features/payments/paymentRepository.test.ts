import { afterEach, describe, expect, it } from 'vitest';
import { mockInvoiceRepository } from './invoiceRepository';
import { mockPaymentRepository } from './paymentRepository';
import { mockMemberRepository } from '../members/memberRepository';
import { phDateAfter } from '../../lib/dates';

afterEach(() => {
  mockPaymentRepository.reset();
  mockInvoiceRepository.reset();
  mockMemberRepository.reset();
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

  it('rejects a payment below the invoice total', async () => {
    const invoice = await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Ana',
      total: 1500,
      dueAt: null
    });

    await expect(
      mockPaymentRepository.recordPayment({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        memberId: 'member-1',
        memberName: 'Ana',
        amount: 500,
        method: 'cash',
        reference: null
      })
    ).rejects.toThrow('Payment amount must equal the invoice total (1500).');
  });

  it('rejects a payment above the invoice total', async () => {
    const invoice = await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Ana',
      total: 1500,
      dueAt: null
    });

    await expect(
      mockPaymentRepository.recordPayment({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        memberId: 'member-1',
        memberName: 'Ana',
        amount: 2000,
        method: 'cash',
        reference: null
      })
    ).rejects.toThrow('Payment amount must equal the invoice total (1500).');
  });

  it('extends the membership end date on an early renewal', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Ana',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    mockMemberRepository.setMembership(member.id, {
      planName: 'Monthly Pass',
      startsAt: '2026-07-16',
      endsAt: '2026-09-15',
      status: 'active'
    });

    const invoice = await mockInvoiceRepository.createInvoice({
      memberId: member.id,
      memberName: 'Ana',
      total: 1500,
      dueAt: null,
      planId: 'plan-monthly'
    });
    await mockPaymentRepository.recordPayment({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: member.id,
      memberName: 'Ana',
      amount: 1500,
      method: 'cash',
      reference: null
    });

    const members = await mockMemberRepository.listMembers();
    const updated = members.find((candidate) => candidate.id === member.id);
    expect(updated?.membership?.endsAt).toBe(phDateAfter('2026-09-15', 30));
  });
});