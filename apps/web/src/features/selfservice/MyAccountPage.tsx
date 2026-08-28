import { useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ghostButtonClass } from '../../components/ui/buttonClasses';
import { formatDate } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockSelfServiceRepository, type SelfServiceAccount } from './selfServiceRepository';
import { SupabaseSelfServiceRepository } from './supabaseSelfServiceRepository';

export function MyAccountPage() {
  const [account, setAccount] = useState<SelfServiceAccount | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoadError(null);
      try {
        if (!hasSupabaseConfig) {
          setAccount(await mockSelfServiceRepository.getMyAccount());
          return;
        }
        setAccount(await new SupabaseSelfServiceRepository().getMyAccount());
      } catch (e) {
        console.warn("Couldn't load your account. Check your connection and try again.", e);
        setAccount(null);
        setLoadError("Couldn't load your account. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <PageShell
      eyebrow="Self-service"
      title="My account"
      description="Your member record and quick links — view-only, straight from your login."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {!hasSupabaseConfig ? (
        <p className="text-sm text-[#A3A3A3]" role="status">
          Demo data — no live database connected.
        </p>
      ) : null}

      {loading || account === undefined ? (
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
      ) : account === null ? (
        <SectionCard
          title="No member record linked"
          description="Your login is not yet linked to a member record."
        >
          <p className="text-sm text-[#A3A3A3]">
            Ask the front desk to link your account while you're in the gym. Staff connect a login from the
            member record (Members → More → Link account).
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Your details" description="Members can view their own record but cannot edit it.">
            <div className="flex items-center gap-3">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">{account.memberName}</p>
              <StatusBadge tone={account.isActive ? 'good' : 'neutral'}>
                {account.isActive ? 'active' : 'inactive'}
              </StatusBadge>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Member since</p>
                <p className="text-sm text-[#FAFAFA]">{formatDate(account.joinedAt)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Email</p>
                <p className="text-sm text-[#FAFAFA]">{account.email ?? 'Not set'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Phone</p>
                <p className="text-sm text-[#FAFAFA]">{account.phone ?? 'Not set'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Plan</p>
                {account.membership ? (
                  <p className="text-sm text-[#FAFAFA]">
                    {account.membership.planName} · until {formatDate(account.membership.endsAt)}
                  </p>
                ) : (
                  <p className="text-sm text-[#A3A3A3]">No active membership</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Quick links" description="Everything tied to your member record.">
            <div className="flex flex-wrap gap-4">
              <a className={ghostButtonClass} href="/app/my-membership">
                My membership
              </a>
              <a className={ghostButtonClass} href={`/app/members/${account.memberId}`}>
                My statement
              </a>
              <a className={ghostButtonClass} href="/app/classes">
                Classes
              </a>
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}