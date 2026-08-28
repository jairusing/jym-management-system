import { useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { chipClass, ghostButtonClass } from '../../components/ui/buttonClasses';
import { formatDate } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import {
  type AnalyticsSnapshot,
  type AnalyticsWindow,
  mockAnalyticsRepository
} from './analyticsRepository';
import { SupabaseAnalyticsRepository } from './supabaseAnalyticsRepository';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

type StatTone = 'good' | 'warning' | 'bad' | 'neutral';

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: StatTone }) {
  const toneClass: Record<StatTone, string> = {
    good: 'text-[#22C55E]',
    warning: 'text-[#FFB300]',
    bad: 'text-[#FF3D00]',
    neutral: 'text-[#FAFAFA]'
  };
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">{label}</p>
      <p className={`text-2xl font-semibold tracking-[-0.04em] ${toneClass[tone]}`}>{value}</p>
    </div>
  );
}

function rateTone(rate: number | null): StatTone {
  if (rate === null) return 'neutral';
  if (rate >= 70) return 'good';
  if (rate >= 40) return 'warning';
  return 'bad';
}

function percent(rate: number | null) {
  return rate === null ? '—' : `${rate}%`;
}

const windowOptions: { value: AnalyticsWindow; label: string }[] = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 365, label: 'This year' }
];

export function AnalyticsPage() {
  const [window, setWindow] = useState<AnalyticsWindow>(30);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const repo = hasSupabaseConfig ? new SupabaseAnalyticsRepository() : mockAnalyticsRepository;
    setLoadError(null);
    setLoading(true);
    repo
      .getAnalytics(window)
      .then((next) => setSnapshot(next))
      .catch((e) => {
        console.warn('Failed to load analytics. Check your connection and try again.', e);
        setSnapshot(null);
        setLoadError(e instanceof Error ? e.message : 'Failed to load analytics. Check your connection and try again.');
      })
      .finally(() => setLoading(false));
  }, [window]);

  const isEmpty = snapshot
    ? snapshot.totalCheckIns === 0 && snapshot.totalCollected === 0 && snapshot.memberPool === 0
    : false;

  return (
    <PageShell
      eyebrow="Management"
      title="Analytics"
      description="Trends computed from your records — attendance, retention, churn and revenue."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {!hasSupabaseConfig ? (
        <p className="text-sm text-[#A3A3A3]" role="status">
          Demo data — no live database connected.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time window">
        {windowOptions.map((option) => (
          <button
            key={option.value}
            className={chipClass(window === option.value)}
            type="button"
            aria-pressed={window === option.value}
            onClick={() => setWindow(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#A3A3A3]">Loading…</p>
      ) : loadError ? (
        <div className="flex flex-col gap-3 border border-[#FFB300] bg-[#1A1A1A] p-4">
          <p role="alert" className="text-sm text-[#FF3D00]">
            {loadError}
          </p>
          <button className={ghostButtonClass} type="button" onClick={() => globalThis.location.reload()}>
            Retry
          </button>
        </div>
      ) : !snapshot ? (
        <p className="text-sm text-[#A3A3A3]">No data yet.</p>
      ) : isEmpty ? (
        <SectionCard title="No data in this window" description="Nothing to chart for the selected period.">
          <p className="text-sm text-[#A3A3A3]">
            Record check-ins, payments and memberships to see trends here. Try a wider window.
          </p>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Attendance"
              description={`${snapshot.totalCheckIns} check-in${snapshot.totalCheckIns === 1 ? '' : 's'} in this window.`}
            >
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Stat label="Check-ins" value={snapshot.totalCheckIns.toLocaleString('en-US')} />
                <Stat label="Unique visitors" value={snapshot.uniqueVisitors.toLocaleString('en-US')} />
                <Stat label="Daily average" value={snapshot.dailyAverage.toLocaleString('en-US')} />
                <Stat
                  label="Peak day"
                  value={
                    snapshot.peakDay ? `${formatDate(snapshot.peakDay.date)} · ${snapshot.peakDay.count}` : '—'
                  }
                />
                <Stat label="Members on plan" value={snapshot.memberPool.toLocaleString('en-US')} />
                <Stat
                  label="Attendance rate"
                  value={percent(snapshot.attendanceRate)}
                  tone={rateTone(snapshot.attendanceRate)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Retention"
              description="Members on a plan when the window opened — are they still training today?"
            >
              <div className="grid gap-6 sm:grid-cols-3">
                <Stat label="Active at window start" value={snapshot.activeAtStart.toLocaleString('en-US')} />
                <Stat label="Still active today" value={snapshot.stillActive.toLocaleString('en-US')} />
                <Stat
                  label="Retention rate"
                  value={percent(snapshot.retentionRate)}
                  tone={rateTone(snapshot.retentionRate)}
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Churn"
              description="Memberships that lapsed within this window, and how many came back."
            >
              <div className="grid gap-6 sm:grid-cols-4">
                <Stat label="Expired" value={snapshot.expiredThisWindow.toLocaleString('en-US')} />
                <Stat label="Renewed" value={snapshot.renewedThisWindow.toLocaleString('en-US')} tone="good" />
                <Stat label="Churned" value={snapshot.churnedThisWindow.toLocaleString('en-US')} tone="bad" />
                <Stat
                  label="Churn rate"
                  value={percent(snapshot.churnRate)}
                  tone={snapshot.churnRate === null ? 'neutral' : 'bad'}
                />
              </div>
            </SectionCard>

            <SectionCard title="Revenue" description="Recorded payments collected in this window.">
              <Stat label="Collected" value={formatMoney(snapshot.totalCollected)} tone="good" />
              <div className="mt-6">
                <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Top members</p>
                {snapshot.topMembers.length === 0 ? (
                  <p className="mt-3 text-sm text-[#A3A3A3]">No payments in this window yet.</p>
                ) : (
                  <ul className="mt-3 flex flex-col">
                    {snapshot.topMembers.map((row) => (
                      <li
                        key={row.memberId}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-[#262626] py-2 text-sm last:border-b-0"
                      >
                        <span className="font-medium text-[#FAFAFA]">{row.memberName}</span>
                        <span className="text-[#A3A3A3]">
                          {row.checkIns} visit{row.checkIns === 1 ? '' : 's'} · {formatMoney(row.totalPaid)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </PageShell>
  );
}