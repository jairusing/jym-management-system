import { useEffect, useState } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { formatDateTime } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { type AuditEntry } from './auditRepository';
import { mockAuditRepository } from './auditRepository';
import { SupabaseAuditRepository } from './supabaseAuditRepository';

function actionTone(action: AuditEntry['action']): StatusTone {
  return action === 'void' ? 'warning' : 'bad';
}

function actionLabel(action: AuditEntry['action'], targetType: string) {
  if (action === 'void') {
    return `voided ${targetType}`;
  }
  const target = targetType === 'members' ? 'member' : targetType === 'check_ins' ? 'check-in' : targetType;
  return `deleted ${target}`;
}

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!hasSupabaseConfig) {
      setEntries(await mockAuditRepository.listAuditEntries());
      setLoading(false);
      return;
    }
    const repo = new SupabaseAuditRepository();
    try {
      setEntries(await repo.listAuditEntries());
    } catch (e) {
      console.warn('Failed to load activity log from Supabase', e);
      setEntries(await mockAuditRepository.listAuditEntries());
      setError(e instanceof Error ? e.message : 'Failed to load activity log.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <PageShell
      title="Activity log"
      eyebrow="Audit trail"
      description="Destructive actions — voided invoices, deleted members, and deleted check-ins — are recorded here automatically."
    >
      <SectionCard title="Recent activity">
        {loading ? (
          <p className="text-sm text-[#A3A3A3]">Loading activity…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[#A3A3A3]">No destructive actions have been recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[#262626]">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-medium text-[#FAFAFA]">
                    {actionLabel(entry.action, entry.targetType)}
                    {entry.details ? ` (${entry.details})` : ''}
                  </p>
                  <p className="mt-1 text-sm text-[#A3A3A3]">
                    {entry.performedByName ? `${entry.performedByName} · ` : 'Unknown account · '}
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
                <StatusBadge tone={actionTone(entry.action)} className="self-start sm:self-auto">
                  {entry.action}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}
    </PageShell>
  );
}