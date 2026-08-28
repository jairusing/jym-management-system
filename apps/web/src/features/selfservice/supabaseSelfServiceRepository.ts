import { supabase } from '../../lib/supabase';
import { type Membership, type MembershipStatus } from '../members/memberRepository';
import { type SelfServiceAccount } from './selfServiceRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type MembershipRow = {
  status: string;
  started_at: string;
  ended_at: string | null;
  created_at: string | null;
  membership_plans: { name: string } | { name: string }[] | null;
};

function mapMembership(row: MembershipRow): Membership {
  return {
    planName: (Array.isArray(row.membership_plans) ? row.membership_plans[0] : row.membership_plans)?.name ??
      'Unknown plan',
    startsAt: row.started_at,
    endsAt: row.ended_at ?? row.started_at,
    status: row.status as MembershipStatus
  };
}

type AccountRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  joined_at: string;
  is_active: boolean;
  memberships: MembershipRow[] | null;
};

const accountColumns =
  'id, full_name, email, phone, joined_at, is_active, memberships(status, started_at, ended_at, created_at, membership_plans(name))';

export class SupabaseSelfServiceRepository {
  async getMyAccount(): Promise<SelfServiceAccount | null> {
    const client = ensureSupabase();

    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return null;
    }

    const { data, error } = await client
      .from('members')
      .select(accountColumns)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load your account: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const latest = [...((data as AccountRow).memberships ?? [])].sort((a, b) => {
      const byStart = b.started_at.localeCompare(a.started_at);
      if (byStart !== 0) return byStart;
      return (b.ended_at ?? b.started_at).localeCompare(a.ended_at ?? a.started_at);
    })[0];

    return {
      memberId: (data as AccountRow).id,
      memberName: (data as AccountRow).full_name,
      email: (data as AccountRow).email,
      phone: (data as AccountRow).phone,
      joinedAt: (data as AccountRow).joined_at,
      isActive: (data as AccountRow).is_active,
      membership: latest ? mapMembership(latest) : null
    };
  }
}