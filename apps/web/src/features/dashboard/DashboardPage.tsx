import { useEffect, useState } from 'react';
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
  'relative inline-flex items-center gap-2 px-1 py-2 text-base font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-colors duration-150 hover:text-[#FF3D00] active:translate-y-px after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#FF3D00]';

export function DashboardPage() {
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(!hasSupabaseConfig);

  const load = async () => {
    if (!hasSupabaseConfig) {
      setView(await mockDashboardRepository.getDashboard());
      setLoading(false);
      setIsDemo(true);
      return;
    }
    const repo = new SupabaseDashboardRepository();
    setError(null);
    setLoading(true);
    try {
      setView(await repo.getDashboard());
      setIsDemo(false);
    } catch (e) {
      console.warn('Failed to load dashboard from Supabase', e);
      setError(e instanceof Error ? e.message : 'Failed to load dashboard.');
      setView(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = view?.stats;
  const weeklyAttendance = view?.weeklyAttendance ?? [];
  const maxDay = Math.max(1, ...weeklyAttendance.map((day) => day.count));
  const todayKey = phDateToday();
  const chartLabel = `Bar chart of daily check-ins over the last 7 days: ${weeklyAttendance
    .map((day) => `${day.label}: ${day.count}${day.date === todayKey ? ' so far' : ''}`)
    .join(', ')}`;

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

      {loading ? (
        <SectionCard title="Attendance">
          <p className="text-sm text-[#A3A3A3]" role="status">
            Loading…
          </p>
        </SectionCard>
      ) : error ? (
        <section className="border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8">
          <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Dashboard</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#A3A3A3]" role="alert">
            Couldn't load the dashboard. {error}
          </p>
          <button
            type="button"
            className={ghostButtonClass}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Retry
          </button>
        </section>
      ) : (
        <>
          <section className="flex flex-col gap-6 border border-[#262626] bg-[#0F0F0F] p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
            <div className="flex flex-col gap-1">
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">Today</p>
              <p className="text-4xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">
                {stats?.attendanceToday ?? 0}
              </p>
              <p className="text-sm text-[#A3A3A3]">check-ins so far</p>
            </div>
            <a href="/app/checkins" className={heroButtonClass}>
              Record a check-in
            </a>
          </section>

          <SectionCard title="Attendance" description="Check-ins over the past week.">
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap gap-10">
                <Stat label="This week" value={String(stats?.attendanceWeek ?? 0)} />
              </div>
              <div>
                <div
                  className="flex h-40 items-end gap-2"
                  role="img"
                  aria-label={chartLabel}
                >
                  {weeklyAttendance.map((day) => {
                    const height = Math.round((day.count / maxDay) * 100);
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
                <p className="mt-2 text-xs text-[#A3A3A3]">Peak: {maxDay} check-ins in a day</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Revenue" description="Recorded payments and outstanding invoices.">
            <div className="flex flex-wrap gap-10">
              <Stat label="This month" value={formatMoney(stats?.revenueMonth ?? 0)} />
              <Stat label="All time" value={formatMoney(stats?.revenueTotal ?? 0)} />
              <Stat label="Outstanding" value={formatMoney(stats?.outstandingTotal ?? 0)} />
            </div>
          </SectionCard>

          <SectionCard title="Membership" description="Active registered members.">
            <div className="flex flex-wrap gap-10">
              <Stat label="Active members" value={String(stats?.activeMembers ?? 0)} />
            </div>
          </SectionCard>
        </>
      )}
    </PageShell>
  );
}