import { useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { ghostButtonClass } from '../../components/ui/buttonClasses';
import { formatDate, phDateToday } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockMembershipRepository, type MyMembership } from './membershipRepository';
import { SupabaseMembershipRepository } from './supabaseMembershipRepository';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

const GRACE_DAYS = 3;

function addDaysIso(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+08:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function statusPresentation(membership: MyMembership): {
  tone: StatusTone;
  label: string;
  message?: string;
} {
  if (membership.status === 'active') {
    if (membership.endsAt >= phDateToday()) {
      return { tone: 'good', label: 'Active' };
    }
    const graceEnd = addDaysIso(membership.endsAt, GRACE_DAYS);
    if (phDateToday() <= graceEnd) {
      return {
        tone: 'warning',
        label: 'Grace',
        message: `Expired ${formatDate(membership.endsAt)} — in ${GRACE_DAYS}-day grace until ${formatDate(graceEnd)}. Renew soon.`
      };
    }
    return {
      tone: 'bad',
      label: 'Expired',
      message: `Expired ${formatDate(membership.endsAt)}. Renew at the front desk.`
    };
  }
  if (membership.status === 'paused') {
    return { tone: 'warning', label: 'Paused' };
  }
  return { tone: 'neutral', label: 'Cancelled' };
}

export function MyMembershipPage() {
  const [membership, setMembership] = useState<MyMembership | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      try {
        if (!hasSupabaseConfig) {
          setMembership(await mockMembershipRepository.getMyMembership());
          return;
        }
        setMembership(await new SupabaseMembershipRepository().getMyMembership());
      } catch (e) {
        console.warn("Couldn't load your membership. Check your connection and try again.", e);
        setMembership(null);
        setLoadError("Couldn't load your membership. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const presentation = membership ? statusPresentation(membership) : null;
  const expiringSoon =
    membership &&
    membership.status === 'active' &&
    membership.endsAt >= phDateToday() &&
    membership.endsAt <= addDaysIso(phDateToday(), 3);

  return (
    <PageShell
      eyebrow="Membership"
      title="My membership"
      description="Your current gym plan at a glance."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {!hasSupabaseConfig ? (
        <p className="text-sm text-[#A3A3A3]" role="status">
          Demo data — no live database connected.
        </p>
      ) : null}

      {loading || membership === undefined ? (
        <p className="text-sm text-[#A3A3A3]">Loading…</p>
      ) : loadError ? (
        <div className="flex flex-col gap-3 border border-[#FFB300] bg-[#1A1A1A] p-4">
          <p role="alert" className="text-sm text-[#FF3D00]">
            {loadError}
          </p>
          <button className={ghostButtonClass} type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      ) : membership === null ? (
        <SectionCard title="No active membership" description="Your account has no active gym plan.">
          <p className="text-sm text-[#A3A3A3]">
            Renew at the front desk to keep training. Staff can issue a plan invoice and record the payment.
          </p>
        </SectionCard>
      ) : (
        <>
          {expiringSoon ? (
            <div className="flex flex-col gap-2 border border-[#FFB300] bg-[#1A1A1A] p-4" role="status">
              <p className="text-sm text-[#FFB300]">
                Your plan ends on {formatDate(membership.endsAt)} — renew at the front desk to keep training.
              </p>
            </div>
          ) : null}
          <SectionCard
            title="Active plan"
            description={`${membership.memberName} · ${presentation?.label ?? membership.status}`}
          >
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex flex-col gap-2">
                <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">{membership.planName}</p>
                <p className="text-sm text-[#A3A3A3]">
                  {formatMoney(membership.planPrice)} · started {formatDate(membership.startedAt)} · until{' '}
                  {formatDate(membership.endsAt)}
                </p>
                {presentation?.message ? (
                  <p className={`text-xs ${presentation.tone === 'warning' ? 'text-[#FFB300]' : 'text-[#FF3D00]'}`}>
                    {presentation.message}
                  </p>
                ) : null}
              </div>
              <StatusBadge tone={presentation?.tone ?? 'neutral'}>{presentation?.label ?? membership.status}</StatusBadge>
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}
