import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { formatDate, formatDateTime } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockLedgerRepository, type MemberStatement } from './ledgerRepository';
import { SupabaseLedgerRepository } from './supabaseLedgerRepository';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

const statusTone: Record<string, string> = {
  active: 'text-[#22C55E]',
  expired: 'text-[#FF3D00]',
  cancelled: 'text-[#737373]',
  paused: 'text-[#FFB300]',
  issued: 'text-[#FFB300]',
  overdue: 'text-[#FF3D00]',
  paid: 'text-[#22C55E]',
  void: 'text-[#737373]'
};

export function MemberStatementPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [statement, setStatement] = useState<MemberStatement | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);

  useEffect(() => {
    if (!memberId) {
      return;
    }
    const load = async () => {
      if (!hasSupabaseConfig) {
        setStatement(await mockLedgerRepository.getMemberStatement(memberId));
        setLoading(false);
        return;
      }
      try {
        setStatement(await new SupabaseLedgerRepository().getMemberStatement(memberId));
      } catch (e) {
        console.warn('Failed to load member statement from Supabase', e);
        setStatement(await mockLedgerRepository.getMemberStatement(memberId));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [memberId]);

  const member = statement?.member;
  const totalPaid = (statement?.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <PageShell eyebrow="Management" title={member?.fullName ?? 'Member statement'}>
      <BackLink to="/app/members" label="Back to members" />

      {loading ? (
        <p className="text-sm text-[#737373]">Loading…</p>
      ) : statement && member ? (
        <>
          <SectionCard
            title={member.fullName}
            description={`Joined ${formatDate(member.joinedAt)} · ${
              member.phone ? ` ${member.phone}` : ''
            }${member.email ? ` · ${member.email}` : ''}`}
          >
            <p className="text-sm text-[#737373]">
              {member.isActive ? 'Active member' : 'Inactive member'}
              {member.membership
                ? ` · ${member.membership.planName} until ${formatDate(member.membership.endsAt)}`
                : ''}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="border border-[#262626] bg-[#1A1A1A] p-4">
                <p className="text-sm text-[#737373]">Outstanding balance</p>
                <p className="mt-1 text-2xl font-semibold text-[#FF3D00]">
                  {formatMoney(statement.outstanding)}
                </p>
              </div>
              <div className="border border-[#262626] bg-[#1A1A1A] p-4">
                <p className="text-sm text-[#737373]">Total paid</p>
                <p className="mt-1 text-2xl font-semibold text-[#22C55E]">
                  {formatMoney(totalPaid)}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Membership history">
            {statement.memberships.length === 0 ? (
              <p className="text-sm text-[#737373]">No memberships recorded.</p>
            ) : (
              <ul className="flex flex-col">
                {statement.memberships.map((membership) => (
                  <li
                    key={`${membership.planName}-${membership.startsAt}`}
                    className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">{membership.planName}</p>
                      <p className="mt-1 text-sm text-[#737373]">
                        {formatDate(membership.startsAt)} → {formatDate(membership.endsAt)}
                      </p>
                    </div>
                    <span
                      className={`text-xs uppercase tracking-[0.2em] ${statusTone[membership.status] ?? 'text-[#737373]'}`}
                    >
                      {membership.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Invoices">
            {statement.invoices.length === 0 ? (
              <p className="text-sm text-[#737373]">No invoices.</p>
            ) : (
              <ul className="flex flex-col">
                {statement.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">{invoice.invoiceNumber}</p>
                      <p className="mt-1 text-sm text-[#737373]">
                        Issued {formatDate(invoice.issuedAt)}
                        {invoice.dueAt ? ` · due ${formatDate(invoice.dueAt)}` : ''}
                        {invoice.planName ? ` · ${invoice.planName}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs uppercase tracking-[0.2em] ${statusTone[invoice.status] ?? 'text-[#737373]'}`}
                      >
                        {invoice.status}
                      </span>
                      <p className="text-base font-semibold text-[#FAFAFA]">
                        {formatMoney(invoice.total)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Payments">
            {statement.payments.length === 0 ? (
              <p className="text-sm text-[#737373]">No payments recorded.</p>
            ) : (
              <ul className="flex flex-col">
                {statement.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">
                        {formatDateTime(payment.paidAt)}
                      </p>
                      <p className="mt-1 text-sm text-[#737373]">
                        {payment.method}
                        {payment.reference ? ` · ${payment.reference}` : ''}
                        {payment.invoiceNumber ? ` · ${payment.invoiceNumber}` : ''}
                      </p>
                    </div>
                    <p className="text-base font-semibold text-[#FAFAFA]">
                      {formatMoney(payment.amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : null}
    </PageShell>
  );
}