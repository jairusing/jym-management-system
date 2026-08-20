// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phDateInDays, phDateToday } from '../../lib/dates';
import { PaymentsPage } from './PaymentsPage';
import { mockInvoiceRepository } from './invoiceRepository';
import { SupabaseInvoiceRepository } from './supabaseInvoiceRepository';
import { mockPaymentRepository } from './paymentRepository';
import { SupabasePaymentRepository } from './supabasePaymentRepository';
import { mockMemberRepository } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';
import { mockStaffRepository } from '../staff/staffRepository';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';

const supabaseConfig = vi.hoisted(() => ({ hasSupabaseConfig: false }));

vi.mock('../../lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: null
}));

vi.mock('./supabaseInvoiceRepository', () => ({
  SupabaseInvoiceRepository: vi.fn()
}));

vi.mock('./supabasePaymentRepository', () => ({
  SupabasePaymentRepository: vi.fn()
}));

vi.mock('../members/supabaseMemberRepository', () => ({
  SupabaseMemberRepository: vi.fn()
}));

vi.mock('../staff/supabaseStaffRepository', () => ({
  SupabaseStaffRepository: vi.fn()
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

function openIssueForm() {
  fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
  return waitFor(() => {
    expect(screen.getByLabelText('Member')).toBeTruthy();
  });
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

function openInvoiceMenu(memberName: string) {
  const row = screen
    .getAllByText((content) => content.startsWith(memberName))
    .map((element) => element.closest('li'))
    .find((element) => element !== null);
  if (!row) {
    throw new Error(`invoice row for ${memberName} not found`);
  }
  fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'More' }));
}

afterEach(() => {
  cleanup();
  mockMemberRepository.reset();
  mockInvoiceRepository.reset();
  mockPaymentRepository.reset();
  mockStaffRepository.reset();
  supabaseConfig.hasSupabaseConfig = false;
  vi.mocked(SupabaseInvoiceRepository).mockReset();
  vi.mocked(SupabasePaymentRepository).mockReset();
  vi.mocked(SupabaseMemberRepository).mockReset();
  vi.mocked(SupabaseStaffRepository).mockReset();
  vi.restoreAllMocks();
});

describe('PaymentsPage', () => {
  it('renders the empty state', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no invoices yet/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'New invoice' })).toBeTruthy();

    goToTab('Payments');
    expect(screen.getByText(/no payments recorded yet/i)).toBeTruthy();
  });

  it('issues an invoice for a member', async () => {
    const member = await seedMember();
    renderPage();

    await openIssueForm();

    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByText('issued')).toBeTruthy();
    });
    expect(screen.getByText('Invoice issued.')).toBeTruthy();
    expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₱1,500.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^INV-/).length).toBe(1);
    expect((screen.getByLabelText('Member') as HTMLSelectElement).value).toBe(member?.id);

    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved.length).toBe(1);
    expect(saved[0]?.total).toBe(1500);
    expect(saved[0]?.memberName).toBe('Juan Dela Cruz');
  });

  it('prefills the total and due date when a plan is selected', async () => {
    const member = await seedMember();
    renderPage();

    await openIssueForm();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Plan (optional)'), { target: { value: 'plan-monthly' } });

    const totalInput = screen.getByLabelText('Total (PHP)') as HTMLInputElement;
    const dueInput = screen.getByLabelText('Due date') as HTMLInputElement;
    expect(totalInput.value).toBe('1500');
    expect(dueInput.value).toBe(phDateInDays(30));
    expect((dueInput as HTMLInputElement).min).toBe(phDateToday());
  });

  it('rejects a due date in the past', async () => {
    const member = await seedMember();
    const { container } = renderPage();

    await openIssueForm();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-08-01' } });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByText('Due date cannot be in the past.')).toBeTruthy();
    });
    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved.length).toBe(0);
  });

  it('records a payment and marks the invoice paid', async () => {
    const member = await seedMember();
    renderPage();

    await openIssueForm();
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
    expect((screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement).getAttribute('aria-expanded')).toBe(
      'true'
    );
    fireEvent.change(screen.getByLabelText('Method'), { target: { value: 'gcash' } });
    fireEvent.change(screen.getByLabelText('Reference'), { target: { value: 'G-12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('paid')).toBeTruthy();
    });
    expect(screen.getByText('Payment recorded.')).toBeTruthy();
    const paidInvoices = await mockInvoiceRepository.listInvoices();
    await waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById(`invoice-statement-${paidInvoices[0]?.id}`));
    });

    goToTab('Payments');
    expect(screen.getAllByText('₱1,500.00').length).toBeGreaterThan(0);
    expect(screen.getByText(/gcash/)).toBeTruthy();
    expect(screen.getByText(/G-12345/)).toBeTruthy();
    expect(screen.getByText(/taken by Front desk/)).toBeTruthy();
    expect(screen.getByText(/Collected by staff — today vs this month/)).toBeTruthy();
    expect(screen.getByText(/₱1,500\.00 today · ₱1,500\.00 this month/)).toBeTruthy();

    const invoices = await mockInvoiceRepository.listInvoices();
    expect(invoices[0]?.status).toBe('paid');
    const payments = await mockPaymentRepository.listPayments();
    expect(payments.length).toBe(1);
    expect(payments[0]?.method).toBe('gcash');
    expect(payments[0]?.reference).toBe('G-12345');
  });

  it('voids an issued invoice after confirmation', async () => {
    const member = await seedMember();
    renderPage();

    await openIssueForm();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    openInvoiceMenu('Juan Dela Cruz');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Void' }));

    const dialog = await screen.findByRole('dialog', { name: 'Void invoice' });
    expect(within(dialog).getByText(/This cannot be undone/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Void invoice' }));

    await waitFor(() => {
      expect(screen.getByText('void')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect(screen.getByText(/invoice .* voided\./i)).toBeTruthy();

    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved[0]?.status).toBe('void');
    const statementLink = document.getElementById(`invoice-statement-${saved[0]?.id}`);
    expect(statementLink).not.toBeNull();
    expect(document.activeElement).toBe(statementLink);
  });

  it('undoes a payment on a paid invoice as the owner', async () => {
    const member = await seedMember();
    renderPage();

    await openIssueForm();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('paid')).toBeTruthy();
    });

    openInvoiceMenu('Juan Dela Cruz');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Undo payment' }));

    const dialog = await screen.findByRole('dialog', { name: 'Undo payment' });
    expect(within(dialog).getByText(/payment record is removed/i)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo payment' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    expect(screen.getByText(/payment on .* undone/i)).toBeTruthy();
    const summaryCard = screen.getByText('Summary').closest('section');
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).getByText('₱800.00')).toBeTruthy();
    expect(within(summaryCard as HTMLElement).getByText('₱0.00')).toBeTruthy();

    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved[0]?.status).toBe('issued');
    expect(saved[0]?.paidAt).toBeNull();
    expect(await mockPaymentRepository.listPayments()).toHaveLength(0);
  });

  it('shows Void to staff on issued invoices and hides the menu on paid rows', async () => {
    mockStaffRepository.setMyRole('staff');
    const member = await seedMember();
    renderPage();

    await openIssueForm();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '800' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    openInvoiceMenu('Juan Dela Cruz');
    expect(screen.getByRole('menuitem', { name: 'Void' })).toBeTruthy();
    const row = screen
      .getAllByText((content) => content.startsWith('Juan Dela Cruz'))
      .map((element) => element.closest('li'))
      .find((element) => element !== null);
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'More' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('paid')).toBeTruthy();
    });
    const paidRow = screen
      .getAllByText((content) => content.startsWith('Juan Dela Cruz'))
      .map((element) => element.closest('li'))
      .find((element) => element !== null);
    expect(paidRow).not.toBeNull();
    expect(within(paidRow as HTMLElement).queryByRole('button', { name: 'More' })).toBeNull();
  });

  it('keeps the invoice when void is cancelled and restores focus to the trigger', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 800,
      dueAt: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    const row = screen
      .getAllByText((content) => content.startsWith('Maria Santos'))
      .map((element) => element.closest('li'))
      .find((element) => element !== null);
    if (!row) {
      throw new Error('invoice row for Maria Santos not found');
    }
    const trigger = within(row as HTMLElement).getByRole('button', { name: 'More' }) as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Void' }));

    const dialog = await screen.findByRole('dialog', { name: 'Void invoice' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(trigger);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    const saved = await mockInvoiceRepository.listInvoices();
    expect(saved[0]?.status).toBe('issued');
  });

  it('closes the payment panel when its invoice is voided', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 800,
      dueAt: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    expect(screen.getByRole('form', { name: 'Record payment' })).toBeTruthy();

    openInvoiceMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Void' }));
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Void invoice' }));

    await waitFor(() => {
      expect(screen.queryByRole('form', { name: 'Record payment' })).toBeNull();
    });
    expect(screen.getByText(/invoice .* voided\./i)).toBeTruthy();
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

    await openIssueForm();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: member?.id } });
    fireEvent.change(screen.getByLabelText('Total (PHP)'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Issue invoice' }));

    await waitFor(() => {
      expect(screen.getAllByText('₱1,000.00').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirm payment' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText('₱0.00')).toBeTruthy();
    });
    expect(screen.getAllByText('₱1,000.00').length).toBeGreaterThan(0);
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

  it('collapses the issue form behind New invoice', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New invoice' })).toBeTruthy();
    });
    expect(screen.queryByLabelText('Member')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    await waitFor(() => {
      expect(screen.getByLabelText('Member')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'New invoice' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New invoice' })).toBeTruthy();
    });
    expect(screen.queryByLabelText('Member')).toBeNull();
  });

  it('searches invoices by member name and invoice number', async () => {
    const first = await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 1000,
      dueAt: null
    });
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-2',
      memberName: 'Pedro Reyes',
      total: 500,
      dueAt: null
    });
    renderPage();

    const search = screen.getByRole('searchbox', { name: 'Search invoices' });
    await waitFor(() => {
      expect(screen.getByText(/Showing 1–2 of 2/)).toBeTruthy();
    });

    fireEvent.change(search, { target: { value: 'Pedro' } });
    await waitFor(() => {
      expect(screen.getByText(/Showing 1–1 of 1/)).toBeTruthy();
    });
    expect(screen.queryByText(/Maria Santos/)).toBeNull();
    expect(screen.getByText(/Pedro Reyes/)).toBeTruthy();

    fireEvent.change(search, { target: { value: first.invoiceNumber } });
    await waitFor(() => {
      expect(screen.getByText(/Showing 1–1 of 1/)).toBeTruthy();
    });
    expect(screen.getByText(/Maria Santos/)).toBeTruthy();

    fireEvent.change(search, { target: { value: 'nobody' } });
    await waitFor(() => {
      expect(screen.getByText(/no invoices match this search/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Pedro Reyes/)).toBeNull();
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

    await openIssueForm();
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
    expect(screen.getByText(/Payment must equal the invoice total/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Confirm payment' }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.change(amount, { target: { value: '100' } });
    expect(screen.getByText(/^Must equal ₱1,500\.00$/)).toBeTruthy();
    expect(amount.getAttribute('aria-invalid')).toBe('true');
    expect(amount.getAttribute('aria-describedby')).toContain('amount-hint');
    expect((screen.getByRole('button', { name: 'Confirm payment' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(amount, { target: { value: '1500' } });
    expect(screen.queryByText(/^Must equal ₱1,500\.00$/)).toBeNull();
    expect(amount.getAttribute('aria-invalid')).toBe('false');
    expect(amount.getAttribute('aria-describedby')).toBeNull();
    expect((screen.getByRole('button', { name: 'Confirm payment' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('records a payment by submitting the payment form', async () => {
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

    const panel = await screen.findByRole('form', { name: 'Record payment' });
    fireEvent.change(within(panel).getByLabelText('Reference'), { target: { value: 'G-67890' } });
    fireEvent.submit(panel);

    await waitFor(() => {
      expect(screen.getByText('paid')).toBeTruthy();
    });
    expect(screen.getByText('Payment recorded.')).toBeTruthy();

    const payments = await mockPaymentRepository.listPayments();
    expect(payments[0]?.reference).toBe('G-67890');
  });

  it('hides the Void button for staff', async () => {
    mockStaffRepository.setMyRole('staff');
    const member = await seedMember();
    await mockInvoiceRepository.createInvoice({
      memberId: member?.id ?? 'member-1',
      memberName: 'Juan Dela Cruz',
      total: 800,
      dueAt: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    expect(screen.queryByRole('menuitem', { name: 'Void' })).toBeNull();
  });

  it('restores focus to the active filter chip when the voided row leaves the filtered list', async () => {
    const invoice = await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 800,
      dueAt: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Record payment' })).toBeTruthy();
    });
    const issuedChip = screen.getByRole('button', { name: 'Filter: Issued' });
    fireEvent.click(issuedChip);
    await waitFor(() => {
      expect(screen.getByText(new RegExp(invoice.invoiceNumber))).toBeTruthy();
    });

    openInvoiceMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Void' }));
    const dialog = await screen.findByRole('dialog', { name: 'Void invoice' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Void invoice' }));

    await waitFor(() => {
      expect(screen.queryByText(new RegExp(invoice.invoiceNumber))).toBeNull();
    });
    expect(document.activeElement).toBe(issuedChip);
  });

  it('shows an honest warning when only the refresh fails after recording a payment', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const invoice = {
      id: 'invoice-1',
      invoiceNumber: 'INV-1001',
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz',
      planId: null,
      planName: null,
      total: 1000,
      status: 'issued',
      issuedAt: '2026-08-01T00:00:00+08:00',
      dueAt: null,
      paidAt: null
    };
    const listInvoices = vi
      .fn()
      .mockResolvedValueOnce([invoice])
      .mockRejectedValueOnce(new Error('Network failure'));
    const listPlans = vi.fn().mockResolvedValue([]);
    const listPayments = vi.fn().mockResolvedValue([]);
    const listMembers = vi.fn().mockResolvedValue([]);
    const recordPayment = vi.fn().mockResolvedValue(undefined);
    vi.mocked(SupabaseInvoiceRepository).mockImplementation(
      () => ({ listInvoices, listPlans }) as unknown as SupabaseInvoiceRepository
    );
    vi.mocked(SupabasePaymentRepository).mockImplementation(
      () => ({ listPayments, recordPayment }) as unknown as SupabasePaymentRepository
    );
    vi.mocked(SupabaseMemberRepository).mockImplementation(
      () => ({ listMembers }) as unknown as SupabaseMemberRepository
    );
    vi.mocked(SupabaseStaffRepository).mockImplementation(
      () => ({ getMyRole: vi.fn(async () => 'owner') }) as unknown as SupabaseStaffRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/INV-1001/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm payment' }));

    await waitFor(() => {
      expect(screen.getByText(/out of date/)).toBeTruthy();
    });
    expect(screen.queryByText('Payment recorded.')).toBeNull();
    expect(recordPayment).toHaveBeenCalledTimes(1);
  });

  it('shows a role error with a retry when the role lookup fails', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const listInvoices = vi.fn().mockResolvedValue([]);
    const listPlans = vi.fn().mockResolvedValue([]);
    const listPayments = vi.fn().mockResolvedValue([]);
    const listMembers = vi.fn().mockResolvedValue([]);
    const getMyRole = vi
      .fn()
      .mockRejectedValueOnce(new Error('Session expired'))
      .mockResolvedValueOnce('owner');
    vi.mocked(SupabaseInvoiceRepository).mockImplementation(
      () => ({ listInvoices, listPlans }) as unknown as SupabaseInvoiceRepository
    );
    vi.mocked(SupabasePaymentRepository).mockImplementation(
      () => ({ listPayments }) as unknown as SupabasePaymentRepository
    );
    vi.mocked(SupabaseMemberRepository).mockImplementation(
      () => ({ listMembers }) as unknown as SupabaseMemberRepository
    );
    vi.mocked(SupabaseStaffRepository).mockImplementation(
      () => ({ getMyRole }) as unknown as SupabaseStaffRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Couldn't verify your role/)).toBeTruthy();
    });
    expect(screen.queryByRole('menuitem', { name: 'Void' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry role' }));
    await waitFor(() => {
      expect(screen.queryByText(/Couldn't verify your role/)).toBeNull();
    });
  });

  it('shows a load error with Retry instead of mock data when Supabase fails', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const listInvoices = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce([
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-1001',
          memberId: 'member-1',
          memberName: 'Juan Dela Cruz',
          planId: null,
          planName: null,
          total: 1000,
          status: 'issued',
          issuedAt: '2026-08-01T00:00:00+08:00',
          dueAt: null,
          paidAt: null
        }
      ]);
    const listPlans = vi.fn().mockResolvedValue([]);
    const listPayments = vi.fn().mockResolvedValue([]);
    const listMembers = vi.fn().mockResolvedValue([]);
    vi.mocked(SupabaseInvoiceRepository).mockImplementation(
      () => ({ listInvoices, listPlans }) as unknown as SupabaseInvoiceRepository
    );
    vi.mocked(SupabasePaymentRepository).mockImplementation(
      () => ({ listPayments }) as unknown as SupabasePaymentRepository
    );
    vi.mocked(SupabaseMemberRepository).mockImplementation(
      () => ({ listMembers }) as unknown as SupabaseMemberRepository
    );
    vi.mocked(SupabaseStaffRepository).mockImplementation(
      () => ({ getMyRole: vi.fn(async () => 'owner') }) as unknown as SupabaseStaffRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Network failure/)).toBeTruthy();
    });
    expect(screen.queryByText(/no invoices yet/i)).toBeNull();
    expect(screen.queryByText(/^INV-/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New invoice' }));
    expect((screen.getByRole('button', { name: 'Issue invoice' }).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByText(/members and plans are unavailable/i)).toBeTruthy();
    const summaryCard = screen.getByText('Summary').closest('section');
    expect(summaryCard).not.toBeNull();
    expect(within(summaryCard as HTMLElement).getAllByText('—').length).toBe(3);
    expect(within(summaryCard as HTMLElement).queryByText('₱' + '0.00')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByText(/INV-1001/)).toBeTruthy();
    });
    expect(screen.queryByText(/Network failure/)).toBeNull();
    expect((screen.getByRole('button', { name: 'Issue invoice' }).closest('fieldset') as HTMLFieldSetElement).disabled).toBe(false);
    expect(within(summaryCard as HTMLElement).getAllByText('₱' + '1,000.00').length).toBeGreaterThan(0);
    expect(within(summaryCard as HTMLElement).queryAllByText('—').length).toBe(0);
  });
});