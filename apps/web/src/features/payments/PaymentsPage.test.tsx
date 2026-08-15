// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PaymentsPage } from './PaymentsPage';
import { mockInvoiceRepository } from './invoiceRepository';
import { mockPaymentRepository } from './paymentRepository';
import { mockMemberRepository } from '../members/memberRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PaymentsPage />
    </MemoryRouter>
  );
}

async function seedMember() {
  await mockMemberRepository.createMember({
    fullName: 'Juan Dela Cruz',
    email: null,
    phone: null,
    joinedAt: '2026-08-01',
    notes: null
  });
  return (await mockMemberRepository.listMembers())[0];
}

afterEach(() => {
  cleanup();
  mockMemberRepository.reset();
  mockInvoiceRepository.reset();
  mockPaymentRepository.reset();
});

describe('PaymentsPage', () => {
  it('renders the empty state', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no invoices yet/i)).toBeTruthy();
    });
    expect(screen.getByText(/no payments recorded yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeTruthy();
  });

  it('issues an invoice for a member', async () => {
    const member = await seedMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Member')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByText('issued')).toBeTruthy();
    });
    expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    expect(screen.getByText(/1,500\.00/)).toBeTruthy();
    expect(screen.getAllByText(/^INV-/).length).toBe(1);

    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved.length).toBe(1);
    expect(saved[0]?.total).toBe(1500);
    expect(saved[0]?.memberName).toBe('Juan Dela Cruz');
  });

  it('records a payment and marks the invoice paid', async () => {
    const member = await seedMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Member')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'gcash' } });
    fireEvent.change(screen.getByLabelText('Reference'), { target: { value: 'G-12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('paid')).toBeTruthy();
    });
    expect(screen.getByText(/1,500\.00 · gcash/)).toBeTruthy();
    expect(screen.getByText(/G-12345/)).toBeTruthy();

    const invoices = await mockInvoiceRepository.listInvoices();
    expect(invoices[0]?.status).toBe('paid');
    const payments = await mockPaymentRepository.listPayments();
    expect(payments.length).toBe(1);
    expect(payments[0]?.method).toBe('gcash');
    expect(payments[0]?.reference).toBe('G-12345');
  });

  it('voids an issued invoice', async () => {
    const member = await seedMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Member')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Void' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Void' }));

    await waitFor(() => {
      expect(screen.getByText('void')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();

    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved[0]?.status).toBe('void');
  });

  it('shows an overdue badge when the due date has passed', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 1000,
      dueAt: '2020-01-01'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('overdue')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
  });
});