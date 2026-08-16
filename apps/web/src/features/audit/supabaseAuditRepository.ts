import { supabase } from '../../lib/supabase';
import { type AuditEntry, type AuditRepository } from './auditRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type AuditRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: string | null;
  performed_by: string | null;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
};

const auditColumns =
  'id, action, target_type, target_id, details, performed_by, created_at, profiles(name)';

function mapEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    action: row.action as AuditEntry['action'],
    targetType: row.target_type,
    targetId: row.target_id,
    details: row.details,
    performedByName: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles)?.name ?? null,
    createdAt: row.created_at
  };
}

export class SupabaseAuditRepository implements AuditRepository {
  async listAuditEntries(): Promise<AuditEntry[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('audit_log')
      .select(auditColumns)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to load activity log: ${error.message}`);
    }

    return (data ?? []).map((row) => mapEntry(row as AuditRow));
  }
}