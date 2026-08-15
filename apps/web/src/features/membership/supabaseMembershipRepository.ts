import { supabase } from '../../lib/supabase';
import { type MyMembership } from './membershipRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type MembershipRow = {
  started_at: string;
  ended_at: string | null;
  status: string;
  membership_plans: { name: string; price: number } | { name: string; price: number }[] | null;
};

export class SupabaseMembershipRepository {
  async getMyMembership(): Promise<MyMembership | null> {
    const client = ensureSupabase();

    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return null;
    }

    const { data: memberData, error: memberError } = await client
      .from('members')
      .select('id, full_name')
      .eq('user_id', userId)
      .maybeSingle();
    if (memberError) {
      throw new Error(`Failed to load profile: ${memberError.message}`);
    }
    if (!memberData) {
      return null;
    }

    const { data: membershipData, error: membershipError } = await client
      .from('memberships')
      .select('started_at, ended_at, status, membership_plans(name, price)')
      .eq('member_id', memberData.id)
      .eq('status', 'active')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (membershipError) {
      throw new Error(`Failed to load membership: ${membershipError.message}`);
    }
    if (!membershipData) {
      return null;
    }

    const row = membershipData as MembershipRow;
    const plan = Array.isArray(row.membership_plans) ? row.membership_plans[0] : row.membership_plans;

    return {
      memberId: memberData.id,
      memberName: memberData.full_name,
      planName: plan?.name ?? 'Unknown plan',
      planPrice: plan?.price ?? 0,
      startedAt: row.started_at,
      endsAt: row.ended_at ?? row.started_at,
      status: row.status
    };
  }
}