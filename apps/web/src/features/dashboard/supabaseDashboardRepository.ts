import { supabase } from '../../lib/supabase';
import { type AttendanceDay, type DashboardView } from './dashboardRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export class SupabaseDashboardRepository {
  async getDashboard(): Promise<DashboardView> {
    const client = ensureSupabase();

    const today = startOfToday();
    const weekStart = addDays(today, -6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayResult, weekResult, weekRows, monthPayments, allPayments, invoices, members] =
      await Promise.all([
        client
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .gte('checked_in_at', today.toISOString()),
        client
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .gte('checked_in_at', weekStart.toISOString()),
        client.from('check_ins').select('checked_in_at').gte('checked_in_at', weekStart.toISOString()),
        client.from('payments').select('amount').gte('paid_at', monthStart.toISOString()),
        client.from('payments').select('amount'),
        client.from('invoices').select('total, status'),
        client
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
      ]);

    const failed = [todayResult, weekResult, weekRows, monthPayments, allPayments, invoices, members].find(
      (result) => result.error
    );
    if (failed?.error) {
      throw new Error(`Failed to load dashboard: ${failed.error.message}`);
    }

    const byDay: Record<string, number> = {};
    for (const row of weekRows.data ?? []) {
      const key = toDateKey(new Date(row.checked_in_at as string));
      byDay[key] = (byDay[key] ?? 0) + 1;
    }
    const weeklyAttendance: AttendanceDay[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = addDays(today, -i);
      const key = toDateKey(date);
      weeklyAttendance.push({
        date: key,
        label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
        count: byDay[key] ?? 0
      });
    }

    const revenueMonth = (monthPayments.data ?? []).reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
    const revenueTotal = (allPayments.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstandingTotal = (invoices.data ?? [])
      .filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'void')
      .reduce((sum, invoice) => sum + Number(invoice.total), 0);

    return {
      stats: {
        attendanceToday: todayResult.count ?? 0,
        attendanceWeek: weekResult.count ?? 0,
        revenueMonth,
        revenueTotal,
        outstandingTotal,
        activeMembers: members.count ?? 0
      },
      weeklyAttendance
    };
  }
}