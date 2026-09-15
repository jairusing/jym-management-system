import { useEffect, useState } from 'react';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { ghostButtonClass } from '../../components/ui/buttonClasses';
import { formatDateTime } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { type AuditEntry } from './auditRepository';
import { mockAuditRepository } from './auditRepository';
import { SupabaseAuditRepository } from './supabaseAuditRepository';

const actionTones: Record<AuditEntry['action'], StatusTone> = {
  delete: 'bad',
  void: 'neutral',
  create_invoice: 'neutral',
  book: 'good',
  cancel_booking: 'neutral',
  rebook: 'good',
  create_membership: 'good',
  payment: 'neutral',
  check_in: 'neutral',
  update_role: 'neutral',
  create_class: 'good',
  update_class: 'neutral',
  delete_class: 'bad',
  create_session: 'good',
  update_session: 'neutral',
  delete_session: 'bad',
  delete_booking: 'bad',
  delete_payment: 'bad',
  create_member: 'good',
  update_member: 'neutral',
};

const actionLabels: Record<AuditEntry['action'], (targetType: string) => string> = {
  delete: (targetType) => {
    const target = targetType === 'members' ? 'member' : targetType === 'check_ins' ? 'check-in' : targetType;
    return `deleted ${target}`;
  },
  void: (targetType) => `voided ${targetType}`,
  create_invoice: () => 'created invoice',
  book: () => 'booked a class',
  cancel_booking: () => 'cancelled a booking',
  rebook: () => 'rebooked a class',
  create_membership: () => 'created membership',
  payment: () => 'recorded a payment',
  check_in: () => 'checked in',
  update_role: () => 'updated a role',
  create_class: () => 'created a class',
  update_class: () => 'updated a class',
  delete_class: () => 'deleted a class',
  create_session: () => 'created a session',
  update_session: () => 'updated a session',
  delete_session: () => 'deleted a session',
  delete_booking: () => 'deleted a booking',
  delete_payment: () => 'deleted a payment',
  create_member: () => 'created a member',
  update_member: () => 'updated a member',
};

function actionTone(action: AuditEntry['action']): StatusTone {
  return actionTones[action] ?? 'neutral';
}

function actionLabel(action: AuditEntry['action'], targetType: string): string {
  const known = actionLabels[action as AuditEntry['action']];
  if (known) {
    return known(targetType);
  }
  // Unknown action types render verbatim — never invent a verb.
  return `${action} ${targetType}`.trim();
}

export function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    if (!hasSupabaseConfig) {
      setEntries(await mockAuditRepository.listAuditEntries());
      setLoading(false);
      return;
    }
    try {
      setEntries(await new SupabaseAuditRepository().listAuditEntries());
    } catch (e) {
      console.warn("Couldn't load activity. Check your connection and try again.", e);
      setEntries([]);
      setLoadError("Couldn't load activity. Check your connection and try again.");
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
      description="All actions are recorded automatically — payments, bookings, memberships, check-ins, invoices, and role changes."
    >
      {!hasSupabaseConfig ? (
        <p className="text-sm text-[#A3A3A3]" role="status">
          Demo data — no live database connected.
        </p>
      ) : null}

      {loading ? (
        <SectionCard title="Recent activity">
          <p className="text-sm text-[#A3A3A3]">Loading activity…</p>
        </SectionCard>
      ) : loadError ? (
        <div className="flex flex-col gap-3 border border-[#FFB300] bg-[#1A1A1A] p-4">
          <p role="alert" className="text-sm text-[#FF3D00]">
            {loadError}
          </p>
          <button className={ghostButtonClass} type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : (
        <SectionCard
          title="Recent activity"
          description={`${entries.length} recorded action${entries.length === 1 ? '' : 's'}.`}
        >
          {entries.length === 0 ? (
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
      )}
    </PageShell>
  );
}
