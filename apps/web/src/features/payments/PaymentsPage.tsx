import { FormEvent, useEffect, useState } from 'react';
import { Ban } from 'lucide-react';
import { BackLink } from '../../components/ui/BackLink';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageShell } from '../../components/ui/PageShell';
import { RowMenu } from '../../components/ui/RowMenu';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { chipClass, ghostButtonClass, inputClass, primaryButtonClass } from '../../components/ui/buttonClasses';
import { formatDate, formatDateTime, phDateInDays, phDateOf, phDateToday, PH_TIME_ZONE } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockInvoiceRepository, type Invoice, type Plan } from './invoiceRepository';
import { SupabaseInvoiceRepository } from './supabaseInvoiceRepository';
import { mockPaymentRepository, type Payment, type PaymentMethod } from './paymentRepository';
import { SupabasePaymentRepository } from './supabasePaymentRepository';
import { mockMemberRepository, type Member } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';
import { mockStaffRepository, type UserRole } from '../staff/staffRepository';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';

const PAGE_SIZE = 15;

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' }
];

type InvoiceFilter = 'all' | 'issued' | 'overdue' | 'paid' | 'void';

type FeedbackHome = 'issue' | 'invoices';

const invoiceFilterChips: { id: InvoiceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'issued', label: 'Issued' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' },
  { id: 'void', label: 'Void' }
];

function today() {
  return phDateToday();
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

function StatusLine({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error ? <p role="alert" className="mb-4 text-sm text-[#FF3D00]">{error}</p> : null}
      {success ? <p role="status" className="mb-4 text-sm text-[#FAFAFA]">{success}</p> : null}
    </>
  );
}

function displayStatus(invoice: Invoice) {
  if (invoice.status === 'issued' && invoice.dueAt && invoice.dueAt < today()) {
    return 'overdue';
  }
  return invoice.status;
}

function manilaMonthKey(isoDate: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit'
  })
    .format(new Date(isoDate))
    .slice(0, 7);
}

export function PaymentsPage() {
  const [tab, setTab] = useState<'invoices' | 'payments'>('invoices');
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>('all');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorHome, setErrorHome] = useState<FeedbackHome>('issue');
  const [successHome, setSuccessHome] = useState<FeedbackHome>('issue');

  const [memberId, setMemberId] = useState('');
  const [planId, setPlanId] = useState('');
  const [total, setTotal] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payReference, setPayReference] = useState('');
  const [paying, setPaying] = useState(false);

  const [pendingVoid, setPendingVoid] = useState<Invoice | null>(null);
  const [voidPending, setVoidPending] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [roleError, setRoleError] = useState(false);
  const [openInvoiceMenu, setOpenInvoiceMenu] = useState<string | null>(null);

  const loadRole = async () => {
    const roleRepo = hasSupabaseConfig ? new SupabaseStaffRepository() : mockStaffRepository;
    try {
      setMyRole(await roleRepo.getMyRole());
      setRoleError(false);
    } catch {
      setMyRole(null);
      setRoleError(true);
    }
  };

  useEffect(() => {
    void loadRole();
  }, []);

  const showError = (message: string, home: FeedbackHome) => {
    setError(message);
    setErrorHome(home);
    setSuccess(null);
  };

  const showSuccess = (message: string, home: FeedbackHome) => {
    setSuccess(message);
    setSuccessHome(home);
    setError(null);
  };

  const load = async (): Promise<boolean> => {
    if (!hasSupabaseConfig) {
      setInvoices(await mockInvoiceRepository.listInvoices());
      setPayments(await mockPaymentRepository.listPayments());
      setMembers(await mockMemberRepository.listMembers());
      setPlans(await mockInvoiceRepository.listPlans());
      setLoading(false);
      return true;
    }
    const invoiceRepo = new SupabaseInvoiceRepository();
    const paymentRepo = new SupabasePaymentRepository();
    const memberRepo = new SupabaseMemberRepository();
    setLoadError(null);
    setLoading(true);
    try {
      const [loadedInvoices, loadedPayments, loadedMembers, loadedPlans] = await Promise.all([
        invoiceRepo.listInvoices(),
        paymentRepo.listPayments(),
        memberRepo.listMembers(),
        invoiceRepo.listPlans()
      ]);
      setInvoices(loadedInvoices);
      setPayments(loadedPayments);
      setMembers(loadedMembers);
      setPlans(loadedPlans);
      return true;
    } catch (e) {
      console.warn('Failed to load payment data from Supabase', e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load payments data.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceFilter, invoiceQuery]);

  const handlePlanChange = (value: string) => {
    setPlanId(value);
    const plan = plans.find((candidate) => candidate.id === value);
    if (plan) {
      setTotal(String(plan.price));
      setDueAt(phDateInDays(plan.durationDays));
    }
  };

  const handleCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const member = members.find((candidate) => candidate.id === memberId);
    if (!member) {
      showError('Select a member for the invoice.', 'issue');
      return;
    }
    if (dueAt && dueAt < phDateToday()) {
      showError('Due date cannot be in the past.', 'issue');
      return;
    }

    const repo = hasSupabaseConfig ? new SupabaseInvoiceRepository() : mockInvoiceRepository;
    setSaving(true);
    try {
      await repo.createInvoice({
        memberId: member.id,
        memberName: member.fullName,
        total: Number(total),
        dueAt: dueAt || null,
        planId: planId || null
      });
setPlanId('');
      setTotal('');
      setDueAt('');
      showSuccess('Invoice issued.', 'issue');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to issue invoice.', 'issue');
      setSaving(false);
      return;
    }
    const refreshed = await load();
    if (!refreshed) {
      showError('Invoice issued, but the list may be out of date — Retry to refresh.', 'issue');
    }
    setSaving(false);
  };

  const handleRecordPayment = async (invoice: Invoice) => {
    if (!payAmount) {
      showError('Enter a payment amount.', 'invoices');
      return;
    }
    const repo = hasSupabaseConfig ? new SupabasePaymentRepository() : mockPaymentRepository;
    setError(null);
    setSuccess(null);
    setPaying(true);
    try {
      await repo.recordPayment({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        memberId: invoice.memberId,
        memberName: invoice.memberName,
        amount: Number(payAmount),
        method: payMethod,
        reference: payReference || null
      });
      setPaymentFor(null);
      setPayAmount('');
      setPayReference('');
      showSuccess('Payment recorded.', 'invoices');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to record payment.', 'invoices');
      setPaying(false);
      return;
    }
    const refreshed = await load();
    if (!refreshed) {
      showError('Payment recorded, but the list may be out of date — Retry to refresh.', 'invoices');
    }
    setPaying(false);
    document.getElementById(`invoice-statement-${invoice.id}`)?.focus();
  };

  const handleVoid = (invoice: Invoice) => {
    setPendingVoid(invoice);
    setVoidError(null);
  };

  const handleConfirmVoid = async () => {
    const invoice = pendingVoid;
    if (!invoice) {
      return;
    }
    const repo = hasSupabaseConfig ? new SupabaseInvoiceRepository() : mockInvoiceRepository;
    setVoidPending(true);
    setVoidError(null);
    try {
      await repo.voidInvoice(invoice.id);
      setPendingVoid(null);
      if (paymentFor === invoice.id) {
        setPaymentFor(null);
        setPayAmount('');
        setPayReference('');
      }
      const refreshed = await load();
      if (refreshed) {
        showSuccess(
          invoice.status === 'paid'
            ? `Payment on ${invoice.invoiceNumber} undone — invoice back to issued.`
            : `Invoice ${invoice.invoiceNumber} voided.`,
          'invoices'
        );
      } else {
        showError(
          invoice.status === 'paid'
            ? `Payment on ${invoice.invoiceNumber} undone, but the list may be out of date — Retry to refresh.`
            : `Invoice ${invoice.invoiceNumber} voided, but the list may be out of date — Retry to refresh.`,
          'invoices'
        );
      }
      const statementLink = document.getElementById(`invoice-statement-${invoice.id}`);
      if (statementLink) {
        statementLink.focus();
      } else {
        const activeChip = invoiceFilterChips.find((chip) => chip.id === invoiceFilter);
        if (activeChip) {
          (document.querySelector(`[aria-label="Filter: ${activeChip.label}"]`) as HTMLElement | null)?.focus();
        }
      }
    } catch (e) {
      setVoidError(e instanceof Error ? e.message : 'Failed to void invoice.');
    } finally {
      setVoidPending(false);
    }
  };

  const invoiceStatusCounts: Record<InvoiceFilter, number> = { all: 0, issued: 0, overdue: 0, paid: 0, void: 0 };
  for (const invoice of invoices) {
    invoiceStatusCounts[displayStatus(invoice)] += 1;
  }
  invoiceStatusCounts.all = invoices.length;

  const outstandingTotal = invoices
    .filter((invoice) => {
      const status = displayStatus(invoice);
      return status === 'issued' || status === 'overdue';
    })
    .reduce((sum, invoice) => sum + invoice.total, 0);

  const currentMonthKey = manilaMonthKey(new Date().toISOString());
  const collectedThisMonth = payments
    .filter((payment) => manilaMonthKey(payment.paidAt) === currentMonthKey)
    .reduce((sum, payment) => sum + payment.amount, 0);

  const staffTotalsToday = new Map<string, number>();
  const staffTotalsMonth = new Map<string, number>();
  for (const payment of payments) {
    const name = payment.processedBy ?? 'Unattributed';
    if (phDateOf(new Date(payment.paidAt)) === phDateToday()) {
      staffTotalsToday.set(name, (staffTotalsToday.get(name) ?? 0) + payment.amount);
    }
    if (manilaMonthKey(payment.paidAt) === currentMonthKey) {
      staffTotalsMonth.set(name, (staffTotalsMonth.get(name) ?? 0) + payment.amount);
    }
  }
  const staffSummary = [...staffTotalsMonth.keys()]
    .sort()
    .map((name) => ({ name, today: staffTotalsToday.get(name) ?? 0, month: staffTotalsMonth.get(name) ?? 0 }));

  const sortedMembers = [...members].sort((a, b) => a.fullName.localeCompare(b.fullName));

  const normalizedQuery = invoiceQuery.trim().toLowerCase();
  const filteredInvoices = invoices.filter((invoice) => {
    const statusMatch = invoiceFilter === 'all' || displayStatus(invoice) === invoiceFilter;
    const queryMatch =
      normalizedQuery === '' ||
      invoice.memberName.toLowerCase().includes(normalizedQuery) ||
      invoice.invoiceNumber.toLowerCase().includes(normalizedQuery);
    return statusMatch && queryMatch;
  });
  const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const invoiceSafePage = Math.min(invoicePage, invoiceTotalPages);
  const visibleInvoices = filteredInvoices.slice((invoiceSafePage - 1) * PAGE_SIZE, invoiceSafePage * PAGE_SIZE);

  const paymentTotalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const paymentSafePage = Math.min(paymentPage, paymentTotalPages);
  const visiblePayments = payments.slice((paymentSafePage - 1) * PAGE_SIZE, paymentSafePage * PAGE_SIZE);

  const payingInvoice = invoices.find((candidate) => candidate.id === paymentFor);
  const amountMismatch = Boolean(payingInvoice) && payAmount !== '' && Number(payAmount) !== (payingInvoice?.total ?? -1);

  return (
    <PageShell
      eyebrow="Management"
      title="Payments"
      description="Issue invoices and record payments. Record-only — no payment processor."
    >
      <BackLink to="/app" label="Back to dashboard" />

      <SectionCard title="Summary" description="At-a-glance money picture for the front desk.">
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Outstanding</p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">
              {loading || loadError ? '—' : formatMoney(outstandingTotal)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Collected this month</p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[#22C55E]">
              {loading || loadError ? '—' : formatMoney(collectedThisMonth)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Overdue invoices</p>
            <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FF3D00]">
              {loading || loadError ? '—' : invoiceStatusCounts.overdue}
            </p>
          </div>
        </div>
      </SectionCard>

      <Tabs
        tabs={[
          { id: 'invoices', label: 'Invoices' },
          { id: 'payments', label: 'Payments' }
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'invoices' | 'payments')}
      />

      {tab === 'invoices' ? (
        <>
          {issueOpen ? (
          <SectionCard title="Issue invoice" description="Create a record-only invoice for a member. Select a plan to renew membership on payment.">
            <StatusLine
              error={errorHome === 'issue' ? error : null}
              success={successHome === 'issue' ? success : null}
            />
            <form className="flex flex-col gap-4" onSubmit={handleCreateInvoice}>
              <fieldset className="m-0 flex flex-col gap-4 min-w-0 border-0 p-0" disabled={loading || loadError !== null}>
                <div className="grid gap-4 sm:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm">
                  <span>Member</span>
                  <select
                    className={inputClass}
                    value={memberId}
                    onChange={(event) => setMemberId(event.target.value)}
                  >
                    <option value="">Select a member…</option>
                    {sortedMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span>Plan (optional)</span>
                  <select
                    className={inputClass}
                    value={planId}
                    onChange={(event) => handlePlanChange(event.target.value)}
                  >
                    <option value="">None</option>
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} — {formatMoney(plan.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span>Total (PHP)</span>
                  <input
                    className={inputClass}
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={total}
                    onChange={(event) => setTotal(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span>Due date</span>
                  <input
                    className={inputClass}
                    type="date"
                    min={phDateToday()}
                    value={dueAt}
                    onChange={(event) => setDueAt(event.target.value)}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button className={primaryButtonClass} type="submit" disabled={saving}>
                  {saving ? 'Issuing…' : 'Issue invoice'}
                </button>
                <button className={ghostButtonClass} type="button" onClick={() => setIssueOpen(false)}>
                  Cancel
                </button>
              </div>
              </fieldset>
              {loading || loadError ? (
                <p className="text-sm text-[#A3A3A3]">
                  {loading ? 'Loading members and plans…' : 'Members and plans are unavailable while the load failed.'}
                </p>
              ) : null}
            </form>
          </SectionCard>
          ) : null}

          <SectionCard title="Invoices" description={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}.`}>
            {!issueOpen ? (
              <div className="mb-6">
                <button className={primaryButtonClass} type="button" onClick={() => setIssueOpen(true)}>
                  New invoice
                </button>
              </div>
            ) : null}
            <StatusLine
              error={errorHome === 'invoices' ? error : null}
              success={successHome === 'invoices' ? success : null}
            />
            {roleError && myRole === null ? (
              <div className="mb-4 flex flex-wrap items-center gap-4">
                <p role="alert" className="text-sm text-[#FF3D00]">
                  Couldn't verify your role — Void is unavailable.
                </p>
                <button
                  className={ghostButtonClass}
                  type="button"
                  onClick={() => void loadRole()}
                >
                  Retry role
                </button>
              </div>
            ) : null}
            {loading ? (
              <p className="text-sm text-[#A3A3A3]">Loading…</p>
            ) : loadError ? (
              <div className="flex flex-col items-start gap-4">
                <p role="alert" className="text-sm text-[#FF3D00]">{loadError}</p>
                <button className={primaryButtonClass} type="button" onClick={() => void load()}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <label className="mb-4 flex flex-col gap-2 text-sm">
                  <span>Find a member or invoice</span>
                  <input
                    className={inputClass}
                    type="search"
                    value={invoiceQuery}
                    onChange={(event) => setInvoiceQuery(event.target.value)}
                    aria-label="Search invoices"
                    placeholder="Search by member or invoice number"
                  />
                </label>
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  {invoiceFilterChips.map((chip) => (
                    <button
                      key={chip.id}
                      className={chipClass(invoiceFilter === chip.id)}
                      type="button"
                      aria-label={`Filter: ${chip.label}`}
                      onClick={() => setInvoiceFilter(chip.id)}
                    >
                      {chip.label} ({invoiceStatusCounts[chip.id]})
                    </button>
                  ))}
                </div>

                {filteredInvoices.length === 0 ? (
                  <p className="text-sm text-[#A3A3A3]">
                    {invoices.length === 0
                      ? 'No invoices yet. Use New invoice to issue the first one.'
                      : invoiceQuery.trim() === ''
                        ? 'No invoices match this filter.'
                        : 'No invoices match this search.'}
                  </p>
                ) : (
                  <ul className="flex flex-col">
                    {visibleInvoices.map((invoice) => {
                      const status = displayStatus(invoice);
                      return (
                        <li key={invoice.id} className="border-b border-[#262626] py-5 last:border-b-0">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-base font-medium text-[#FAFAFA]">
                                {invoice.memberName}
                                <StatusBadge
                                  tone={
                                    status === 'paid'
                                      ? 'good'
                                      : status === 'void'
                                        ? 'neutral'
                                        : status === 'overdue'
                                          ? 'bad'
                                          : 'warning'
                                  }
                                  className="ml-3"
                                >
                                  {status}
                                </StatusBadge>
                              </p>
                              <p className="mt-1 text-sm text-[#A3A3A3]">
                                {invoice.invoiceNumber}
                                {invoice.planName ? ` · ${invoice.planName}` : ''}
                                {` · issued ${formatDate(invoice.issuedAt)}`}
                                {invoice.dueAt ? ` · due ${formatDate(invoice.dueAt)}` : ''}
                                {invoice.paidAt ? ` · paid ${formatDate(invoice.paidAt)}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-4">
                              <p className="font-mono text-lg tracking-[-0.02em] text-[#FAFAFA]">
                                {formatMoney(invoice.total)}
                              </p>
                              <div className="flex shrink-0 flex-wrap gap-2 whitespace-nowrap">
                              <a
                                className={ghostButtonClass}
                                href={`/app/members/${invoice.memberId}`}
                                id={`invoice-statement-${invoice.id}`}
                              >
                                Statement
                              </a>
                              {status === 'issued' || status === 'overdue' ? (
                                <>
                                  <button
                                    className={ghostButtonClass}
                                    type="button"
                                    disabled={paying}
                                    aria-expanded={paymentFor === invoice.id}
                                    aria-controls={`payment-panel-${invoice.id}`}
                                    onClick={() => {
                                      setPaymentFor(paymentFor === invoice.id ? null : invoice.id);
                                      setPayAmount(String(invoice.total));
                                      setPayMethod('cash');
                                      setPayReference('');
                                    }}
                                  >
                                    {paymentFor === invoice.id ? 'Close' : 'Record payment'}
                                  </button>
                                  <RowMenu
                                    id={`invoice-menu-${invoice.id}`}
                                    open={openInvoiceMenu === invoice.id}
                                    onOpenChange={(next) => setOpenInvoiceMenu(next ? invoice.id : null)}
                                    items={[
                                      {
                                        label: 'Void',
                                        icon: Ban,
                                        danger: true,
                                        disabled: voidPending,
                                        onClick: () => handleVoid(invoice)
                                      }
                                    ]}
                                  />
                                </>
                              ) : myRole === 'owner' ? (
                                <RowMenu
                                  id={`invoice-menu-${invoice.id}`}
                                  open={openInvoiceMenu === invoice.id}
                                  onOpenChange={(next) => setOpenInvoiceMenu(next ? invoice.id : null)}
                                  items={[
                                    {
                                      label: 'Undo payment',
                                      icon: Ban,
                                      danger: true,
                                      disabled: voidPending,
                                      onClick: () => handleVoid(invoice)
                                    }
                                  ]}
                                />
                              ) : null}
                            </div>
                            </div>
                          </div>

                          {paymentFor === invoice.id ? (
                            <form
                              id={`payment-panel-${invoice.id}`}
                              aria-label="Record payment"
                              className="mt-4 flex flex-col gap-3 border border-[#262626] bg-[#1A1A1A] p-4"
                              onSubmit={(event) => {
                                event.preventDefault();
                                void handleRecordPayment(invoice);
                              }}
                            >
                              <p className="text-sm text-[#A3A3A3]">
                                Payment must equal the invoice total of {formatMoney(invoice.total)}.
                              </p>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <label className="flex flex-col gap-2 text-sm">
                                  <span>Amount</span>
                                  <input
                                    className={inputClass}
                                    type="number"
                                    min={0.01}
                                    step={0.01}
                                    value={payAmount}
                                    onChange={(event) => setPayAmount(event.target.value)}
                                    autoFocus
                                    aria-invalid={amountMismatch}
                                    aria-describedby={amountMismatch ? `amount-hint-${invoice.id}` : undefined}
                                    required
                                  />
                                  {amountMismatch ? (
                                    <span id={`amount-hint-${invoice.id}`} className="text-xs text-[#FF3D00]">
                                      Must equal {formatMoney(payingInvoice?.total ?? 0)}
                                    </span>
                                  ) : null}
                                </label>
                                <label className="flex flex-col gap-2 text-sm">
                                  <span>Method</span>
                                  <select
                                    className={inputClass}
                                    value={payMethod}
                                    onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}
                                  >
                                    {paymentMethods.map((method) => (
                                      <option key={method.value} value={method.value}>
                                        {method.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex flex-col gap-2 text-sm">
                                  <span>Reference</span>
                                  <input
                                    className={inputClass}
                                    type="text"
                                    value={payReference}
                                    onChange={(event) => setPayReference(event.target.value)}
                                  />
                                </label>
                              </div>
                              <div>
                                <button
                                  className={primaryButtonClass}
                                  type="submit"
                                  disabled={paying || amountMismatch || payAmount === ''}
                                >
                                  {paying ? 'Recording…' : 'Confirm payment'}
                                </button>
                              </div>
                            </form>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
                  <p className="text-sm text-[#A3A3A3]">
                    {filteredInvoices.length === 0
                      ? '0 results'
                      : `Showing ${(invoiceSafePage - 1) * PAGE_SIZE + 1}–${Math.min(invoiceSafePage * PAGE_SIZE, filteredInvoices.length)} of ${filteredInvoices.length}`}
                  </p>
                  <div className="flex gap-2">
                    <button
                      className={ghostButtonClass}
                      type="button"
                      disabled={invoiceSafePage <= 1}
                      onClick={() => setInvoicePage(invoiceSafePage - 1)}
                    >
                      Prev
                    </button>
                    <button
                      className={ghostButtonClass}
                      type="button"
                      disabled={invoiceSafePage >= invoiceTotalPages}
                      onClick={() => setInvoicePage(invoiceSafePage + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard title="Payments" description={`${payments.length} recorded payment${payments.length === 1 ? '' : 's'}.`}>
          {loading ? (
            <p className="text-sm text-[#A3A3A3]">Loading…</p>
          ) : loadError ? (
            <div className="flex flex-col items-start gap-4">
              <p role="alert" className="text-sm text-[#FF3D00]">{loadError}</p>
              <button className={primaryButtonClass} type="button" onClick={() => void load()}>
                Retry
              </button>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-[#A3A3A3]">No payments recorded yet.</p>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
                  Collected by staff — today vs this month
                </p>
                <ul className="mt-3 flex flex-col">
                  {staffSummary.length === 0 ? (
                    <p className="text-sm text-[#A3A3A3]">No collections yet this month.</p>
                  ) : (
                    staffSummary.map((row) => (
                      <li
                        key={row.name}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] py-2 text-sm last:border-b-0"
                      >
                        <span className="font-medium text-[#FAFAFA]">{row.name}</span>
                        <span className="text-[#A3A3A3]">
                          {formatMoney(row.today)} today · {formatMoney(row.month)} this month
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <ul className="flex flex-col">
                {visiblePayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-base font-medium text-[#FAFAFA]">{payment.memberName}</p>
                    <p className="mt-1 text-sm text-[#A3A3A3]">
                      {payment.method}
                      {payment.reference ? ` · ${payment.reference}` : ''} · {payment.invoiceNumber}
                    </p>
                    <p className="mt-1 text-sm text-[#A3A3A3]">
                      {formatDateTime(payment.paidAt)}
                      {payment.processedBy ? ` · taken by ${payment.processedBy}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-lg tracking-[-0.02em] text-[#FAFAFA]">
                    {formatMoney(payment.amount)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <p className="text-sm text-[#A3A3A3]">
                {payments.length === 0
                  ? '0 results'
                  : `Showing ${(paymentSafePage - 1) * PAGE_SIZE + 1}–${Math.min(paymentSafePage * PAGE_SIZE, payments.length)} of ${payments.length}`}
              </p>
              <div className="flex gap-2">
                <button
                  className={ghostButtonClass}
                  type="button"
                  disabled={paymentSafePage <= 1}
                  onClick={() => setPaymentPage(paymentSafePage - 1)}
                >
                  Prev
                </button>
                <button
                  className={ghostButtonClass}
                  type="button"
                  disabled={paymentSafePage >= paymentTotalPages}
                  onClick={() => setPaymentPage(paymentSafePage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
            </>
          )}
        </SectionCard>
      )}

      {pendingVoid ? (
        <ConfirmModal
          title={pendingVoid.status === 'paid' ? 'Undo payment' : 'Void invoice'}
          body={
            pendingVoid.status === 'paid'
              ? `Undo the payment on ${pendingVoid.invoiceNumber} (${formatMoney(pendingVoid.total)})? The payment record is removed and the invoice returns to issued.`
              : `Void ${pendingVoid.invoiceNumber} (${formatMoney(pendingVoid.total)})? This cannot be undone.`
          }
          confirmLabel={pendingVoid.status === 'paid' ? 'Undo payment' : 'Void invoice'}
          pendingLabel={pendingVoid.status === 'paid' ? 'Undoing…' : 'Voiding…'}
          danger
          pending={voidPending}
          error={voidError}
          restoreFocusId={`invoice-menu-${pendingVoid.id}`}
          onConfirm={() => void handleConfirmVoid()}
          onCancel={() => {
            if (!voidPending) {
              setPendingVoid(null);
            }
          }}
        />
      ) : null}
    </PageShell>
  );
}