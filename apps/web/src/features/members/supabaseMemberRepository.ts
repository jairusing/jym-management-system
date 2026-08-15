import { supabase } from '../../lib/supabase';
import { type Member, type MemberInput } from './memberRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type MemberRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  joined_at: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

function mapMember(row: MemberRow): Member {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    joinedAt: row.joined_at,
    notes: row.notes,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

export class SupabaseMemberRepository {
  async listMembers(): Promise<Member[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('members')
      .select('id, user_id, full_name, email, phone, joined_at, notes, is_active, created_at')
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
      .select('id, user_id, full_name, email, phone, joined_at, notes, is_active, created_at')
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
      .select('id, user_id, full_name, email, phone, joined_at, notes, is_active, created_at')
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
      .select('id, user_id, full_name, email, phone, joined_at, notes, is_active, created_at')
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