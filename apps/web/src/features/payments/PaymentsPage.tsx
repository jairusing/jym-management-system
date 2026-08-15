import { FormEvent, useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockInvoiceRepository, type Invoice } from './invoiceRepository';
import { SupabaseInvoiceRepository } from './supabaseInvoiceRepository';
import { mockPaymentRepository, type Payment, type PaymentMethod } from './paymentRepository';
import { SupabasePaymentRepository } from './supabasePaymentRepository';
import { mockMemberRepository, type Member } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

const inputClass =
  'border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]';

const buttonClass =
  'inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:opacity-50';

const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank transfer' }
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(`${date}T00:00:00`)
  );
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(date));
}

function displayStatus(invoice: Invoice) {
  if (invoice.status === 'issued' && invoice.dueAt && invoice.dueAt < today()) {
    return 'overdue';
  }
  return invoice.status;
}

export function PaymentsPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [memberId, setMemberId] = useState('');
  const [total, setTotal] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [saving, setSaving] = useState(false);

  const [paymentFor, setPaymentFor] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payReference, setPayReference] = useState('');
  const [paying, setPaying] = useState(false);

  const load = async () => {
    if (!hasSupabaseConfig) {
      setInvoices(await mockInvoiceRepository.listInvoices());
      setPayments(await mockPaymentRepository.listPayments());
      setMembers(await mockMemberRepository.listMembers());
      setLoading(false);
      return;
    }
    const invoiceRepo = new SupabaseInvoiceRepository();
    const paymentRepo = new SupabasePaymentRepository();
    const memberRepo = new SupabaseMemberRepository();
    try {
      const [loadedInvoices, loadedPayments, loadedMembers] = await Promise.all([
        invoiceRepo.listInvoices(),
        paymentRepo.listPayments(),
        memberRepo.listMembers()
      ]);
      setInvoices(loadedInvoices);
      setPayments(loadedPayments);
      setMembers(loadedMembers);
    } catch (e) {
      console.warn('Failed to load payment data from Supabase', e);
      setInvoices(await mockInvoiceRepository.listInvoices());
      setPayments(await mockPaymentRepository.listPayments());
      setMembers(await mockMemberRepository.listMembers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const member = members.find((candidate) => candidate.id === memberId);
    if (!member) {
      setError('Select a member for the invoice.');
      return;
    }

    const repo = hasSupabaseConfig ? new SupabaseInvoiceRepository() : mockInvoiceRepository;
    setSaving(true);
    try {
      await repo.createInvoice({
        memberId: member.id,
        memberName: member.fullName,
        total: Number(total),
        dueAt: dueAt || null
      });
      setMemberId('');
      setTotal('');
      setDueAt('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to issue invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (invoice: Invoice) => {
    if (!payAmount) {
      setError('Enter a payment amount.');
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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record payment.');
    } finally {
      setPaying(false);
    }
  };

  const handleVoid = async (invoice: Invoice) => {
    const repo = hasSupabaseConfig ? new SupabaseInvoiceRepository() : mockInvoiceRepository;
    setError(null);
    setSuccess(null);
    try {
      await repo.voidInvoice(invoice.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to void invoice.');
    }
  };

  return (
    <PageShell
      eyebrow="Management"
      title="Payments"
      description="Issue invoices and record payments. Record-only — no payment processor."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}
      {success ? <p className="text-sm text-[#FAFAFA]">{success}</p> : null}

      <SectionCard title="Issue invoice" description="Create a record-only invoice for a member.">
        <form className="flex flex-col gap-4" onSubmit={handleCreateInvoice}>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span>Member</span>
              <select
                className={inputClass}
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">Select a member…</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
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
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
          </div>

          <div>
            <button className={buttonClass} type="submit" disabled={saving}>
              {saving ? 'Issuing…' : 'Issue invoice'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Invoices" description={`${invoices.length} invoice${invoices.length === 1 ? '' : 's'}.`}>
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-[#737373]">No invoices yet. Issue your first invoice above.</p>
        ) : (
          <ul className="flex flex-col">
            {invoices.map((invoice) => {
              const status = displayStatus(invoice);
              return (
                <li key={invoice.id} className="border-b border-[#262626] py-5 last:border-b-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">
                        {invoice.invoiceNumber}
                        <span
                          className={`ml-3 text-[0.7rem] uppercase tracking-[0.2em] ${
                            status === 'paid' ? 'text-[#737373]' : 'text-[#FF3D00]'
                          }`}
                        >
                          {status}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-[#737373]">
                        {invoice.memberName} · {formatMoney(invoice.total)} · issued {formatDate(invoice.issuedAt)}
                        {invoice.dueAt ? ` · due ${formatDate(invoice.dueAt)}` : ''}
                        {invoice.paidAt ? ` · paid ${formatDate(invoice.paidAt)}` : ''}
                      </p>
                    </div>
                    {status === 'issued' || status === 'overdue' ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className={buttonClass}
                          type="button"
                          onClick={() => {
                            setPaymentFor(paymentFor === invoice.id ? null : invoice.id);
                            setPayAmount(String(invoice.total));
                            setPayMethod('cash');
                            setPayReference('');
                          }}
                        >
                          {paymentFor === invoice.id ? 'Close' : 'Record payment'}
                        </button>
                        <button
                          className={`${buttonClass} border-[#262626] text-[#737373] hover:text-[#FF3D00]`}
                          type="button"
                          onClick={() => void handleVoid(invoice)}
                        >
                          Void
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {paymentFor === invoice.id ? (
                    <div className="mt-4 flex flex-col gap-3 border border-[#262626] bg-[#1A1A1A] p-4">
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
                            required
                          />
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
                          className={buttonClass}
                          type="button"
                          disabled={paying}
                          onClick={() => void handleRecordPayment(invoice)}
                        >
                          {paying ? 'Recording…' : 'Confirm payment'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Payments" description={`${payments.length} recorded payment${payments.length === 1 ? '' : 's'}.`}>
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-[#737373]">No payments recorded yet.</p>
        ) : (
          <ul className="flex flex-col">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-base font-medium text-[#FAFAFA]">{payment.memberName}</p>
                <p className="text-sm text-[#737373]">
                  {formatMoney(payment.amount)} · {payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ''} · {payment.invoiceNumber} ·{' '}
                  {formatDateTime(payment.paidAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageShell>
  );
}