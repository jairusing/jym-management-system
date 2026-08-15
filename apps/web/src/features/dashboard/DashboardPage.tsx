import { useEffect, useState } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockDashboardRepository, type DashboardView } from './dashboardRepository';
import { SupabaseDashboardRepository } from './supabaseDashboardRepository';

const buttonClass =
  'inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:opacity-50';

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#737373]">{label}</p>
      <p className="text-2xl font-semibold tracking-[-0.04em] text-[#FAFAFA]">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const [view, setView] = useState<DashboardView | null>(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);

  const load = async () => {
    if (!hasSupabaseConfig) {
      setView(await mockDashboardRepository.getDashboard());
      setLoading(false);
      return;
    }
    const repo = new SupabaseDashboardRepository();
    try {
      setView(await repo.getDashboard());
    } catch (e) {
      console.warn('Failed to load dashboard from Supabase', e);
      setView(await mockDashboardRepository.getDashboard());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = view?.stats;
  const maxDay = Math.max(1, ...(view?.weeklyAttendance.map((day) => day.count) ?? [1]));

  return (
    <PageShell
      eyebrow="Home"
      title="Dashboard"
      description="Attendance, revenue, and membership at a glance."
    >
      <SectionCard title="Attendance" description="Check-ins today and over the past week.">
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap gap-10">
              <Stat label="Today" value={String(stats?.attendanceToday ?? 0)} />
              <Stat label="This week" value={String(stats?.attendanceWeek ?? 0)} />
            </div>
            <div className="flex h-40 items-end gap-2" aria-label="Daily check-ins, last 7 days">
              {(view?.weeklyAttendance ?? []).map((day) => {
                const height = Math.round((day.count / maxDay) * 100);
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <p className="text-sm text-[#737373]">{day.count}</p>
                    <div
                      className={`w-full border border-[#262626] ${day.count > 0 ? 'bg-[#FF3D00]' : 'bg-[#1A1A1A]'}`}
                      style={{ height: `${Math.max(height, 4)}px` }}
                    />
                    <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#737373]">{day.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Revenue" description="Recorded payments and outstanding invoices.">
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-10">
            <Stat label="This month" value={formatMoney(stats?.revenueMonth ?? 0)} />
            <Stat label="All time" value={formatMoney(stats?.revenueTotal ?? 0)} />
            <Stat label="Outstanding" value={formatMoney(stats?.outstandingTotal ?? 0)} />
          </div>
        )}
      </SectionCard>

      <SectionCard title="Membership" description="Active registered members.">
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-10">
            <Stat label="Active members" value={String(stats?.activeMembers ?? 0)} />
          </div>
        )}
      </SectionCard>

      <div>
        <a href="/app/checkins" className={buttonClass}>
          Record a check-in
        </a>
      </div>
    </PageShell>
  );
}