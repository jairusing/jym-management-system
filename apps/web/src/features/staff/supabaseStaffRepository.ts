import { supabase } from '../../lib/supabase';
import { type StaffProfile, type UserRole } from './staffRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
};

export class SupabaseStaffRepository {
  async getMyRole(): Promise<UserRole | null> {
    const client = ensureSupabase();

    const { data: session } = await client.auth.getSession();
    const userId = session?.session?.user.id;
    if (!userId) {
      return null;
    }

    const { data, error } = await client
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load your role: ${error.message}`);
    }
    return data ? ((data as { role: string }).role as UserRole) : null;
  }

  async getMyProfileId(): Promise<string | null> {
    // profiles.id is the auth user id (handle_new_user trigger), so the
    // session user id identifies this owner's own profile row.
    const client = ensureSupabase();
    const { data: session } = await client.auth.getSession();
    return session?.session?.user.id ?? null;
  }

  async listProfiles(): Promise<StaffProfile[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load staff: ${error.message}`);
    }
    return (data ?? []).map((row) => mapProfile(row as ProfileRow));
  }

  async updateRole(profileId: string, role: UserRole): Promise<void> {
    const client = ensureSupabase();

    const { error } = await client
      .from('profiles')
      .update({ role })
      .eq('id', profileId);

    if (error) {
      throw new Error(`Failed to update role: ${error.message}`);
    }
  }
}

function mapProfile(row: ProfileRow): StaffProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    createdAt: row.created_at
  };
}