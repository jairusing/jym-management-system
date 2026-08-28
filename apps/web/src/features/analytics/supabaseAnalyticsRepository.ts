import { supabase } from '../../lib/supabase';
import { phDayStartUtc, phDateAfter, phDateToday } from '../../lib/dates';
import {
  type AnalyticsInput,
  type AnalyticsRepository,
  type AnalyticsSnapshot,
  type AnalyticsWindow,
  computeAnalytics
} from './analyticsRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

export class SupabaseAnalyticsRepository implements AnalyticsRepository {
  async getAnalytics(windowDays: AnalyticsWindow): Promise<AnalyticsSnapshot> {
    const client = ensureSupabase();

    const fromId = phDateAfter(phDateToday(), -(windowDays - 1));
    const fromIso = phDayStartUtc(fromId);

    const [checkIns, memberships, members, payments] = await Promise.all([
      client
        .from('check_ins')
        .select('member_id, checked_in_at')
        .gte('checked_in_at', fromIso),
      client.from('memberships').select('member_id, started_at, ended_at, status'),
      client.from('members').select('id, full_name'),
      client
        .from('payments')
        .select('member_id, amount, paid_at')
        .gte('paid_at', fromIso)
    ]);

    const failed = [checkIns, memberships, members, payments].find((result) => result.error);
    if (failed) {
      throw new Error(`Failed to load analytics: ${failed.error?.message ?? 'unknown'}`);
    }

    const input: AnalyticsInput = {
      checkIns: (checkIns.data ?? []).map((row) => ({
        memberId: (row as { member_id: string }).member_id,
        checkedInAt: (row as { checked_in_at: string }).checked_in_at
      })),
      memberships: (memberships.data ?? []).map((row) => ({
        memberId: (row as { member_id: string }).member_id,
        startedAt: (row as { started_at: string }).started_at,
        endedAt: (row as { ended_at: string | null }).ended_at,
        status: (row as { status: string }).status
      })),
      members: (members.data ?? []).map((row) => ({
        id: (row as { id: string }).id,
        fullName: (row as { full_name: string }).full_name
      })),
      payments: (payments.data ?? []).map((row) => ({
        memberId: (row as { member_id: string }).member_id,
        amount: (row as { amount: number }).amount,
        paidAt: (row as { paid_at: string }).paid_at
      }))
    };

    return computeAnalytics(input, windowDays);
  }
}