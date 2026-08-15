// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberStatementPage } from './MemberStatementPage';
import { mockMemberRepository } from '../members/memberRepository';
import { mockInvoiceRepository } from '../payments/invoiceRepository';
import { mockPaymentRepository } from '../payments/paymentRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

async function seedStatement() {
  const member = await mockMemberRepository.createMember({
    fullName: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '0917 000 0001',
    joinedAt: '2026-08-01',
    notes: null
  });
  mockMemberRepository.setMembershipHistory(member.id, [
    {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'active'
    },
    {
      planName: 'Monthly Pass',
      startsAt: '2026-07-01',
      endsAt: '2026-07-31',
      status: 'expired'
    }
  ]);
  const invoice = await mockInvoiceRepository.createInvoice({
    memberId: member.id,
    memberName: member.fullName,
    total: 1500,
    dueAt: '2026-08-15'
  });
  await mockInvoiceRepository.createInvoice({
    memberId: member.id,
    memberName: member.fullName,
    total: 2000,
    dueAt: null
  });
  await mockPaymentRepository.recordPayment({
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    memberId: member.id,
    memberName: member.fullName,
    amount: 1500,
    method: 'gcash',
    reference: 'REF-1'
  });
  return member.id;
}

function renderPage(memberId: string) {
  return render(
    <MemoryRouter initialEntries={[`/app/members/${memberId}`]}>
      <Routes>
        <Route path="/app/members/:memberId" element={<MemberStatementPage />} />
      </Routes>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockMemberRepository.reset();
  mockInvoiceRepository.reset();
  mockPaymentRepository.reset();
});

describe('MemberStatementPage', () => {
  it('shows member details, balances, invoices, payments, and membership history', async () => {
    const memberId = await seedStatement();
    renderPage(memberId);

    await waitFor(() => {
      expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/Outstanding balance/)).toBeTruthy();
    expect(screen.getAllByText(/₱2,000/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Total paid/)).toBeTruthy();
    expect(screen.getAllByText(/₱1,500/).length).toBeGreaterThan(0);

    expect(screen.getAllByText('Monthly Pass').length).toBe(2);
    expect(screen.getByText('expired')).toBeTruthy();
    expect(screen.getByText('active')).toBeTruthy();

    expect(screen.getAllByText(/INV-/).length).toBeGreaterThan(0);
    expect(screen.getByText(/gcash/)).toBeTruthy();
  });

  it('shows a zero state for a member with no activity', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-02',
      notes: null
    });
    renderPage(member.id);

    await waitFor(() => {
      expect(screen.getAllByText('Maria Santos').length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/No memberships recorded/)).toBeTruthy();
    expect(screen.getByText('No invoices.')).toBeTruthy();
    expect(screen.getByText('No payments recorded.')).toBeTruthy();
    expect(screen.getAllByText(/₱0/).length).toBeGreaterThan(0);
  });
});