import { supabase } from '../../lib/supabase';
import { type Member, type MemberInput, type Membership, type MembershipStatus, toJoinedAt } from './memberRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

function translateConstraintError(message: string): string {
  if (message.includes('members_email_key')) {
    return 'A member with this email already exists.';
  }
  if (message.includes('members_phone_key')) {
    return 'A member with this phone number already exists.';
  }
  return message;
}

type MembershipRow = {
  status: string;
  started_at: string;
  ended_at: string | null;
  created_at: string | null;
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
    endsAt: row.ended_at ?? row.started_at,
    status: row.status as MembershipStatus
  };
}

function mapMember(row: MemberRow): Member {
  const latest = [...(row.memberships ?? [])].sort((a, b) => {
    const byStart = b.started_at.localeCompare(a.started_at);
    if (byStart !== 0) return byStart;
    const byEnd = (b.ended_at ?? b.started_at).localeCompare(a.ended_at ?? a.started_at);
    if (byEnd !== 0) return byEnd;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  })[0];
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.joined_at,
    notes: row.notes,
    isActive: row.is_active,
    membership: latest ? mapMembership(latest) : null,
    createdAt: row.created_at
  };
}

const memberColumns =
  'id, user_id, full_name, email, phone, joined_at, notes, is_active, memberships(status, started_at, ended_at, created_at, membership_plans(name)), created_at';

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
        joined_at: toJoinedAt(input.joinedAt),
        notes: input.notes?.trim() || null
      })
      .select(memberColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to create member: ${translateConstraintError(error?.message ?? 'unknown')}`);
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
    if (input.joinedAt !== undefined) payload.joined_at = toJoinedAt(input.joinedAt);
    if (input.notes !== undefined) payload.notes = input.notes?.trim() || null;

    const { data, error } = await client
      .from('members')
      .update(payload)
      .eq('id', id)
      .select(memberColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to update member: ${translateConstraintError(error?.message ?? 'unknown')}`);
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
      throw new Error(`Failed to update member: ${translateConstraintError(error?.message ?? 'unknown')}`);
    }

    return mapMember(data as MemberRow);
  }

  async setMembershipStatus(id: string, status: 'active' | 'paused' | 'cancelled'): Promise<Member> {
    const client = ensureSupabase();

    const { data: membershipData } = await client
      .from('memberships')
      .select('id')
      .eq('member_id', id)
      .in('status', ['active', 'paused'])
      .maybeSingle();

    if (!membershipData) {
      throw new Error('No active membership to update.');
    }

    const { error } = await client
      .from('memberships')
      .update({ status })
      .eq('member_id', id)
      .in('status', ['active', 'paused']);

    if (error) {
      throw new Error(`Failed to update membership: ${error.message}`);
    }

    const { data: memberData, error: loadError } = await client
      .from('members')
      .select(memberColumns)
      .eq('id', id)
      .single();

    if (loadError || !memberData) {
      throw new Error(`Membership updated but failed to load member: ${loadError?.message ?? 'unknown'}`);
    }

    return mapMember(memberData as MemberRow);
  }

  async setMemberPin(id: string, pin: string | null): Promise<Member> {
    const client = ensureSupabase();

    const { error } = await client.rpc('rpc_set_member_pin', { p_member_id: id, p_pin: pin });
    if (error) {
      throw new Error(`Failed to set PIN: ${error.message}`);
    }

    const { data: memberData, error: loadError } = await client
      .from('members')
      .select(memberColumns)
      .eq('id', id)
      .single();

    if (loadError || !memberData) {
      throw new Error(`PIN set but failed to load member: ${loadError?.message ?? 'unknown'}`);
    }

    return mapMember(memberData as MemberRow);
  }

  async verifyMemberPin(id: string, pin: string): Promise<'ok' | 'missing' | 'fail'> {
    const client = ensureSupabase();

    const { data, error } = await client.rpc('rpc_verify_member_pin', { p_member_id: id, p_pin: pin });
    if (error) {
      throw new Error(`Failed to verify PIN: ${error.message}`);
    }
    return data === 'ok' || data === 'missing' || data === 'fail' ? data : 'fail';
  }

  async deleteMember(id: string): Promise<void> {
    const client = ensureSupabase();

    const [invoiceCount, paymentCount] = await Promise.all([
      client.from('invoices').select('id', { count: 'exact', head: true }).eq('member_id', id),
      client.from('payments').select('id', { count: 'exact', head: true }).eq('member_id', id)
    ]);
    const blockers: string[] = [];
    if (invoiceCount.error) {
      throw new Error(`Failed to check member history: ${invoiceCount.error.message}`);
    }
    if (paymentCount.error) {
      throw new Error(`Failed to check member history: ${paymentCount.error.message}`);
    }
    if ((invoiceCount.count ?? 0) > 0) {
      blockers.push('invoices');
    }
    if ((paymentCount.count ?? 0) > 0) {
      blockers.push('payments');
    }
    if (blockers.length > 0) {
      throw new Error(
        `Cannot delete this member because they have ${blockers.join(' and ')} on record. ` +
          'Deleting would destroy billing history. Consider deactivating them instead.'
      );
    }

    const { error } = await client.from('members').delete().eq('id', id);
    if (error) {
      throw new Error(`Failed to delete member: ${error.message}`);
    }
  }
}
