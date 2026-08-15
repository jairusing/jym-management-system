import { supabase } from '../../lib/supabase';
import { type Member, type MemberInput, type Membership } from './memberRepository';

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
  membership_plans: { name: string } | { name: string }[] | null;
};

type MemberRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  joined_at: string;
  notes: string | null;
  is_active: boolean;
  memberships: MembershipRow[] | null;
  created_at: string;
};

function mapMembership(row: MembershipRow): Membership {
  return {
    planName: (Array.isArray(row.membership_plans) ? row.membership_plans[0] : row.membership_plans)?.name ??
      'Unknown plan',
    startsAt: row.started_at,
    endsAt: row.ended_at ?? row.started_at
  };
}

function mapMember(row: MemberRow): Member {
  const active = (row.memberships ?? []).find((membership) => membership.status === 'active');
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.joined_at,
    notes: row.notes,
    isActive: row.is_active,
    membership: active ? mapMembership(active) : null,
    createdAt: row.created_at
  };
}

const memberColumns =
  'id, user_id, full_name, email, phone, joined_at, notes, is_active, memberships(status, started_at, ended_at, membership_plans(name)), created_at';

export class SupabaseMemberRepository {
  async listMembers(): Promise<Member[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('members')
      .select(memberColumns)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load members: ${error.message}`);
    }

    return (data ?? []).map((row) => mapMember(row as MemberRow));
  }

  async createMember(input: MemberInput): Promise<Member> {
    const client = ensureSupabase();

    if (!input.fullName.trim()) {
      throw new Error('Member name is required.');
    }

    const { data, error } = await client
      .from('members')
      .insert({
        full_name: input.fullName.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        joined_at: input.joinedAt,
        notes: input.notes?.trim() || null
      })
      .select(memberColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to create member: ${error?.message ?? 'unknown'}`);
    }

    return mapMember(data as MemberRow);
  }

  async updateMember(id: string, input: Partial<MemberInput>): Promise<Member> {
    const client = ensureSupabase();

    const payload: Partial<{
      full_name: string;
      email: string | null;
      phone: string | null;
      joined_at: string;
      notes: string | null;
    }> = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName.trim();
    if (input.email !== undefined) payload.email = input.email?.trim() || null;
    if (input.phone !== undefined) payload.phone = input.phone?.trim() || null;
    if (input.joinedAt !== undefined) payload.joined_at = input.joinedAt;
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

    const { data, error } = await client
      .from('members')
      .update(payload)
      .eq('id', id)
      .select(memberColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to update member: ${error?.message ?? 'unknown'}`);
    }

    return mapMember(data as MemberRow);
  }

  async setMemberActive(id: string, isActive: boolean): Promise<Member> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('members')
      .update({ is_active: isActive })
      .eq('id', id)
      .select(memberColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to update member: ${error?.message ?? 'unknown'}`);
    }

    return mapMember(data as MemberRow);
  }

  async deleteMember(id: string): Promise<void> {
    const client = ensureSupabase();

    const { error } = await client.from('members').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete member: ${error.message}`);
    }
  }
}