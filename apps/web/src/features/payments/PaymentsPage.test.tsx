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

function goToTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }));
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
    expect(screen.getByRole('button', { name: 'Issue invoice' })).toBeTruthy();

    goToTab('Payments');
    expect(screen.getByText(/no payments recorded yet/i)).toBeTruthy();
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
    expect(screen.getByText(/· ₱1,500\.00 · issued/)).toBeTruthy();
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

    goToTab('Payments');
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

  it('shows the summary strip with outstanding, collected, and overdue totals', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 1000,
      dueAt: null
    });
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 500,
      dueAt: '2020-01-01'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('₱1,500.00')).toBeTruthy();
    });
    expect(screen.getByText('₱0.00')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('updates the summary after recording a payment', async () => {
    const member = await seedMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Member')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByText('₱1,000.00')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('₱0.00')).toBeTruthy();
    });
    expect(screen.getByText('₱1,000.00')).toBeTruthy();
  });

  it('filters invoices by status chips with counts', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 1000,
      dueAt: null
    });
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 500,
      dueAt: '2020-01-01'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Filter: All' })).toBeTruthy();
    });
    expect(screen.getByText('Issued (1)')).toBeTruthy();
    expect(screen.getByText('Overdue (1)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Filter: Overdue' }));

    await waitFor(() => {
      expect(screen.getByText(/Showing 1–1 of 1/)).toBeTruthy();
    });
    expect(screen.getByText(/₱500\.00/)).toBeTruthy();
    expect(screen.queryByText(/₱1,000\.00/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Filter: Paid' }));

    await waitFor(() => {
      expect(screen.getByText(/no invoices match this filter/i)).toBeTruthy();
    });
  });

  it('paginates the invoice list', async () => {
    for (let i = 1; i <= 17; i += 1) {
      await mockInvoiceRepository.createInvoice({
        memberId: `member-${i}`,
        memberName: `Member ${i}`,
        total: 100,
        dueAt: null
      });
    }
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Showing 1–15 of 17')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Showing 16–17 of 17')).toBeTruthy();
    });
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('paginates the payments list', async () => {
    const member = await seedMember();
    for (let i = 1; i <= 17; i += 1) {
      const invoice = await mockInvoiceRepository.createInvoice({
        memberId: member?.id ?? 'member-1',
        memberName: 'Juan Dela Cruz',
        total: 100,
        dueAt: null
      });
      await mockPaymentRepository.recordPayment({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        memberId: member?.id ?? 'member-1',
        memberName: 'Juan Dela Cruz',
        amount: 100,
        method: 'cash',
        reference: null
      });
    }
    renderPage();

    goToTab('Payments');
    await waitFor(() => {
      expect(screen.getByText('Showing 1–15 of 17')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => {
      expect(screen.getByText('Showing 16–17 of 17')).toBeTruthy();
    });
  });

  it('links each invoice row to the member statement', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 1000,
      dueAt: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Statement' })).toBeTruthy();
    });
    expect((screen.getByRole('link', { name: 'Statement' }) as HTMLAnchorElement).href).toMatch(/\/app\/members\/member-1$/);
  });

  it('renews membership when a plan invoice is paid', async () => {
    const member = await seedMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Member')).toBeTruthy();
    });
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Plan (optional)'), { target: { value: 'plan-monthly' } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByText(/Monthly Pass ·/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('paid')).toBeTruthy();
    });

    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved[0]?.planName).toBe('Monthly Pass');
    const savedMembers = await mockMemberRepository.listMembers();
    expect(savedMembers[0]?.membership?.planName).toBe('Monthly Pass');
    expect(savedMembers[0]?.membership?.endsAt).toBeTruthy();
  });

  it('blocks confirm when the payment amount differs from the invoice total', async () => {
    const member = await seedMember();
    await mockInvoiceRepository.createInvoice({
      memberId: member?.id ?? 'member-1',
      memberName: 'Juan Dela Cruz',
      total: 1500,
      dueAt: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeTruthy();
    });

    const amount = screen.getByLabelText('Amount') as HTMLInputElement;
    expect(amount.value).toBe('1500');
    expect((screen.getByRole('button', { name: 'Confirm payment' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(amount, { target: { value: '100' } });
    expect(screen.getByText(/must equal/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Confirm payment' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(amount, { target: { value: '1500' } });
    expect(screen.queryByText(/must equal/i)).toBeNull();
    expect((screen.getByRole('button', { name: 'Confirm payment' }) as HTMLButtonElement).disabled).toBe(false);
  });
});