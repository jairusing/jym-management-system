import { supabase } from '../../lib/supabase';
import { phDateToday, phDayStartUtc } from '../../lib/dates';
import { type CheckIn, type CheckInInput } from './checkInRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type CheckInRow = {
  id: string;
  member_id: string;
  checked_in_at: string;
  method: 'manual' | 'qr';
  processed_by: string | null;
  members: { full_name: string } | { full_name: string }[] | null;
};

const selectColumns = 'id, member_id, checked_in_at, method, processed_by, members(full_name)';

function mapCheckIn(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: (Array.isArray(row.members) ? row.members[0] : row.members)?.full_name ?? 'Unknown member',
    checkedInAt: row.checked_in_at,
    method: row.method,
    processedBy: row.processed_by
  };
}

function startOfToday() {
  return phDayStartUtc(phDateToday());
}

export class SupabaseCheckInRepository {
  async listTodayCheckIns(): Promise<CheckIn[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('check_ins')
      .select(selectColumns)
      .gte('checked_in_at', startOfToday())
      .order('checked_in_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load check-ins: ${error.message}`);
    }

    return (data ?? []).map((row) => mapCheckIn(row as CheckInRow));
  }

  async listCheckIns(from: string, to: string): Promise<CheckIn[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('check_ins')
      .select(selectColumns)
      .gte('checked_in_at', from)
      .lte('checked_in_at', to)
      .order('checked_in_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load check-ins: ${error.message}`);
    }

    return (data ?? []).map((row) => mapCheckIn(row as CheckInRow));
  }

  async recordCheckIn(input: CheckInInput): Promise<CheckIn> {
    const client = ensureSupabase();

    if (!input.memberId) {
      throw new Error('Select a member to check in.');
    }

    const { data: duplicate, error: duplicateError } = await client
      .from('check_ins')
      .select('id')
      .eq('member_id', input.memberId)
      .gte('checked_in_at', startOfToday())
      .limit(1);
    if (duplicateError) {
      throw new Error(`Failed to check for duplicates: ${duplicateError.message}`);
    }
    if (duplicate && duplicate.length > 0) {
      throw new Error('Already checked in today.');
    }

    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      throw new Error('Failed to identify signed-in user: no active session.');
    }

    const { data, error } = await client
      .from('check_ins')
      .insert({
        member_id: input.memberId,
        method: input.method ?? 'manual',
        processed_by: userId
      })
      .select(selectColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to record check-in: ${error?.message ?? 'unknown'}`);
    }

    return mapCheckIn(data as CheckInRow);
  }

  async deleteCheckIn(id: string): Promise<void> {
    const client = ensureSupabase();

    const { error } = await client.from('check_ins').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete check-in: ${error.message}`);
    }
  }
}