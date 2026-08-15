import { useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { formatDate } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockMembershipRepository, type MyMembership } from './membershipRepository';
import { SupabaseMembershipRepository } from './supabaseMembershipRepository';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function MyMembershipPage() {
  const [membership, setMembership] = useState<MyMembership | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const repo = hasSupabaseConfig ? new SupabaseMembershipRepository() : mockMembershipRepository;
        setMembership(await repo.getMyMembership());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load membership.');
      }
    };
    void load();
  }, []);

  return (
    <PageShell
      eyebrow="Membership"
      title="My membership"
      description="Your current gym plan at a glance."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}

      {membership === undefined ? (
        <p className="text-sm text-[#737373]">Loading…</p>
      ) : membership === null ? (
        <SectionCard title="No active membership" description="Your account has no active gym plan.">
          <p className="text-sm text-[#737373]">
            Renew at the front desk to keep training. Staff can issue a plan invoice and record the payment.
          </p>
        </SectionCard>
      ) : (
        <SectionCard
          title="Active plan"
          description={`${membership.memberName} · ${membership.status}`}
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">{membership.planName}</p>
              <p className="text-sm text-[#737373]">
                {formatMoney(membership.planPrice)} · started {formatDate(membership.startedAt)} · until{' '}
                {formatDate(membership.endsAt)}
              </p>
            </div>
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#737373]">Active</p>
          </div>
        </SectionCard>
      )}
    </PageShell>
  );
}