import { supabase } from '../../lib/supabase';
import { phDateInDays, phDateOf, phDayStartUtc } from '../../lib/dates';
import { type AttendanceDay, type DashboardView, type ExpiringMember } from './dashboardRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

function monthStartUtc() {
  const today = phDateInDays(0);
  return phDayStartUtc(`${today.slice(0, 7)}-01`);
}

export class SupabaseDashboardRepository {
  async getDashboard(): Promise<DashboardView> {
    const client = ensureSupabase();

    const todayStart = phDayStartUtc(phDateInDays(0));
    const weekStart = phDayStartUtc(phDateInDays(-6));

    const [todayResult, weekResult, weekRows, monthPayments, allPayments, invoices, members, expiring] =
      await Promise.all([
        client
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .gte('checked_in_at', todayStart),
        client
          .from('check_ins')
          .select('id', { count: 'exact', head: true })
          .gte('checked_in_at', weekStart),
        client.from('check_ins').select('checked_in_at').gte('checked_in_at', weekStart),
        client.from('payments').select('amount').gte('paid_at', monthStartUtc()),
        client.from('payments').select('amount'),
        client.from('invoices').select('total, status'),
        client
          .from('members')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        client
          .from('memberships')
          .select('member_id, ended_at, members(full_name)')
          .eq('status', 'active')
          .gte('ended_at', phDateInDays(0))
          .lte('ended_at', phDateInDays(3))
      ]);

    const failed = [todayResult, weekResult, weekRows, monthPayments, allPayments, invoices, members, expiring].find(
      (result) => result.error
    );
    if (failed?.error) {
      throw new Error(`Failed to load dashboard: ${failed.error.message}`);
    }

    const byDay: Record<string, number> = {};
    for (const row of weekRows.data ?? []) {
      const key = phDateOf(new Date(row.checked_in_at as string));
      byDay[key] = (byDay[key] ?? 0) + 1;
    }
    const weeklyAttendance: AttendanceDay[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = phDateInDays(-i);
      weeklyAttendance.push({
        date,
        label: new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Manila',
          weekday: 'short'
        }).format(new Date(`${date}T12:00:00+08:00`)),
        count: byDay[date] ?? 0
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

    const expiringMembers: ExpiringMember[] = (expiring.data ?? []).map((row) => {
      const typed = row as { member_id: string; ended_at: string; members: { full_name: string } | { full_name: string }[] | null };
      const memberEmbed = Array.isArray(typed.members) ? typed.members[0] : typed.members;
      return {
        id: typed.member_id,
        fullName: memberEmbed?.full_name ?? 'Unknown member',
        endsAt: typed.ended_at
      };
    });

    return {
      stats: {
        attendanceToday: todayResult.count ?? 0,
        attendanceWeek: weekResult.count ?? 0,
        revenueMonth,
        revenueTotal,
        outstandingTotal,
        activeMembers: members.count ?? 0
      },
      weeklyAttendance,
      expiringMembers
    };
  }
}