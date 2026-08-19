import { useCallback, useEffect, useRef, useState } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { ghostButtonClass } from '../../components/ui/buttonClasses';
import { hasSupabaseConfig } from '../../lib/supabase';
import { phDateToday } from '../../lib/dates';
import { mockDashboardRepository, type DashboardView } from './dashboardRepository';
import { SupabaseDashboardRepository } from './supabaseDashboardRepository';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">{label}</p>
      <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">{value}</p>
    </div>
  );
}

const heroButtonClass =
  'relative inline-flex items-center gap-2 px-1 py-2 text-base font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-colors duration-150 hover:text-[#FF3D00] active:translate-y-px focus-visible:after:scale-x-110 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#FF3D00]';

function updatedAt() {
  return new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

export function DashboardPage() {
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(!hasSupabaseConfig);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const refreshRetryRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef(false);
  const viewRef = useRef<DashboardView | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshError(null);
    if (!hasSupabaseConfig) {
      const demo = await mockDashboardRepository.getDashboard();
      viewRef.current = demo;
      setView(demo);
      setIsDemo(true);
      setLastUpdated(updatedAt());
      setLoading(false);
      return;
    }
    const repo = new SupabaseDashboardRepository();
    setError(null);
    try {
      const data = await repo.getDashboard();
      viewRef.current = data;
      setView(data);
      setIsDemo(false);
      setLastUpdated(updatedAt());
    } catch (e) {
      console.warn('Failed to load dashboard from Supabase', e);
      const message = e instanceof Error ? e.message : 'Failed to load dashboard.';
      restoreFocusRef.current = false;
      if (viewRef.current) {
        setRefreshError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (error) {
      retryRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    if (refreshError) {
      refreshRetryRef.current?.focus();
    }
  }, [refreshError]);

  useEffect(() => {
    if (!loading && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      heroRef.current?.focus();
    }
  }, [loading]);

  const stats = view?.stats;
  const weeklyAttendance = view?.weeklyAttendance ?? [];
  const peak = weeklyAttendance.reduce((max, day) => Math.max(max, day.count), 0);
  const todayKey = phDateToday();
  const chartLabel = `Bar chart of daily check-ins over the last 7 days${
    weeklyAttendance.length > 0
      ? `: ${weeklyAttendance
          .map((day) => `${day.label}: ${day.count}${day.date === todayKey ? ' so far' : ''}`)
          .join(', ')}`
      : ''
  }`;

  const requestReload = () => {
    restoreFocusRef.current = true;
    void load();
  };

  return (
    <PageShell
      eyebrow="Home"
      title="Dashboard"
      description="Attendance, revenue, and membership at a glance."
    >
      {isDemo ? (
        <p className="text-sm text-[#A3A3A3]" role="status">
          Demo data — no live database connected.
        </p>
      ) : null}

      {refreshError ? (
        <div className="flex flex-col gap-3 border border-[#262626] bg-[#0F0F0F] p-4 sm:p-6" role="alert">
          <p className="text-sm leading-relaxed text-[#A3A3A3]">
            Couldn't refresh the dashboard — showing data from {lastUpdated ?? 'the last load'}.
          </p>
          <p className="text-xs leading-relaxed text-[#737373]">{refreshError}</p>
          <button
            type="button"
            ref={refreshRetryRef}
            className={ghostButtonClass}
            onClick={requestReload}
            disabled={loading}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !view ? (
        <SectionCard title="Attendance" titleAs="h2">
          <p className="text-sm text-[#A3A3A3]" role="status">
            Loading…
          </p>
        </SectionCard>
      ) : error ? (
        <section className="border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8">
          <h2 className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
            Dashboard unavailable
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#A3A3A3]" role="alert">
            Couldn't load the dashboard.
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#737373]">{error}</p>
          <button
            type="button"
            ref={retryRef}
            className={ghostButtonClass}
            onClick={requestReload}
            disabled={loading}
          >
            Retry
          </button>
        </section>
      ) : view ? (
        <>
          <section className="flex flex-col gap-6 border border-[#262626] bg-[#0F0F0F] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div className="flex flex-col gap-1">
              <h2
                ref={heroRef}
                tabIndex={-1}
                className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]"
              >
                Today
              </h2>
              <p className="text-4xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">
                {stats?.attendanceToday ?? 0}
              </p>
              <p className="text-sm text-[#A3A3A3]">check-ins so far</p>
            </div>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-6">
              {lastUpdated ? (
                <p className="text-xs text-[#A3A3A3]" aria-live="polite">
                  Updated {lastUpdated}
                </p>
              ) : null}
              {!isDemo ? (
                <button
                  type="button"
                  className={`${ghostButtonClass} min-w-28 justify-center`}
                  onClick={requestReload}
                  disabled={loading}
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              ) : null}
              <a href="/app/checkins" className={heroButtonClass}>
                Record a check-in
              </a>
            </div>
          </section>

          <SectionCard
            title="Attendance"
            description="Check-ins over the last 7 days."
            titleAs="h2"
          >
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap gap-10">
                <Stat label="Last 7 days" value={String(stats?.attendanceWeek ?? 0)} />
              </div>
              <div>
                <div
                  className="flex h-40 items-end gap-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#FF3D00]"
                  role="img"
                  aria-label={chartLabel}
                  tabIndex={0}
                >
                  {weeklyAttendance.map((day) => {
                    const height = peak > 0 ? Math.round((day.count / peak) * 100) : 0;
                    const isToday = day.date === todayKey;
                    return (
                      <div
                        key={day.date}
                        className="flex flex-1 flex-col items-center gap-2"
                        title={`${day.label}: ${day.count}${isToday ? ' so far' : ''}`}
                      >
                        <p className="text-sm text-[#A3A3A3]">{day.count}</p>
                        <div
                          className={`w-full border border-[#262626] ${
                            day.count > 0 ? 'bg-[#FF3D00]' : 'bg-[#1A1A1A]'
                          }`}
                          style={{ height: `${Math.max(height, 4)}px` }}
                        />
                        <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
                          {day.label}
                        </p>
                        <span
                          className={`h-1 w-1 rounded-full ${isToday ? 'bg-[#FF3D00]' : 'bg-transparent'}`}
                          aria-hidden="true"
                        />
                      </div>
                    );
                  })}
                </div>
                {peak > 0 ? (
                  <p className="mt-2 text-xs text-[#A3A3A3]">
                    Peak: {peak} check-in{peak === 1 ? '' : 's'} in a day
                  </p>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Revenue" description="Recorded payments and outstanding invoices." titleAs="h2">
            <div className="flex flex-wrap gap-10">
              <Stat label="This month" value={formatMoney(stats?.revenueMonth ?? 0)} />
              <Stat label="All time" value={formatMoney(stats?.revenueTotal ?? 0)} />
              <Stat label="Outstanding" value={formatMoney(stats?.outstandingTotal ?? 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Membership" description="Active registered members." titleAs="h2">
            <div className="flex flex-wrap gap-10">
              <Stat label="Active members" value={String(stats?.activeMembers ?? 0)} />
            </div>
          </SectionCard>
        </>
      ) : null}
    </PageShell>
  );
}