import { useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { RowMenu } from '../../components/ui/RowMenu';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { chipClass, ghostButtonClass } from '../../components/ui/buttonClasses';
import { formatDate } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockStaffRepository, type StaffProfile, type UserRole } from './staffRepository';
import { SupabaseStaffRepository } from './supabaseStaffRepository';

const roleTone: Record<UserRole, StatusTone> = {
  owner: 'warning',
  staff: 'good',
  member: 'neutral'
};

const DOMAIN_ERROR_MESSAGES = new Set(['Only the owner can change staff roles.']);

function toUserError(e: unknown, fallback: string): string {
  console.warn(fallback, e);
  const message = e instanceof Error ? e.message : String(e);
  if (DOMAIN_ERROR_MESSAGES.has(message)) {
    return message;
  }
  const separator = message.indexOf(': ');
  if (separator !== -1) {
    const detail = message.slice(separator + 2);
    if (DOMAIN_ERROR_MESSAGES.has(detail)) {
      return detail;
    }
  }
  return fallback;
}

type PendingRoleChange = {
  profile: StaffProfile;
  role: UserRole;
};

export function StaffPage() {
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingRoleChange | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    if (!hasSupabaseConfig) {
      setMyRole(await mockStaffRepository.getMyRole());
      setProfiles(await mockStaffRepository.listProfiles());
      setLoading(false);
      return;
    }
    const repo = new SupabaseStaffRepository();
    try {
      const [role, loaded, profileId] = await Promise.all([
        repo.getMyRole(),
        repo.listProfiles(),
        repo.getMyProfileId()
      ]);
      setMyRole(role);
      setProfiles(loaded);
      setMyProfileId(profileId);
    } catch (e) {
      console.warn("Couldn't load accounts. Please try again.", e);
      setMyRole(null);
      setProfiles([]);
      setLoadError("Couldn't load accounts. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const ownerCount = profiles.filter((profile) => profile.role === 'owner').length;

  const requestRoleChange = (profile: StaffProfile, role: UserRole) => {
    if (profile.role === 'owner' && role !== 'owner') {
      if (myProfileId !== null && profile.id === myProfileId) {
        setError("You can't change your own role while signed in as its owner.");
        return;
      }
      if (ownerCount <= 1) {
        setError('This is the only owner account — promote another owner first.');
        return;
      }
    }
    setError(null);
    setPendingChange({ profile, role });
  };

  const handleConfirmRoleChange = async () => {
    const change = pendingChange;
    if (!change) {
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const repo = hasSupabaseConfig ? new SupabaseStaffRepository() : mockStaffRepository;
      await repo.updateRole(change.profile.id, change.role);
      setPendingChange(null);
      await load();
    } catch (e) {
      setPendingChange(null);
      setError(toUserError(e, "Couldn't update the role. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const visibleProfiles = showMembers ? profiles : profiles.filter((profile) => profile.role !== 'member');
  const staffCount = profiles.filter((profile) => profile.role === 'staff').length;

  return (
    <PageShell eyebrow="Management" title="Staff">
      <BackLink to="/app" label="Back to dashboard" />

      {loading ? (
        <p className="text-sm text-[#A3A3A3]">Loading…</p>
      ) : loadError ? (
        <div className="flex flex-col gap-3 border border-[#FFB300] bg-[#1A1A1A] p-4">
          <p role="alert" className="text-sm text-[#FF3D00]">
            {loadError}
          </p>
          <button className={ghostButtonClass} type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : myRole !== 'owner' ? (
        <SectionCard title="Owner access required">
          <p className="text-sm text-[#A3A3A3]">
            Only the owner can manage staff accounts and roles.
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Accounts"
            description={`${profiles.length} account${profiles.length === 1 ? '' : 's'} — ${ownerCount} owner${ownerCount === 1 ? '' : 's'}, ${staffCount} staff.`}
          >
            {error ? (
              <p role="alert" className="mb-4 text-sm text-[#FF3D00]">
                {error}
              </p>
            ) : null}
            <div className="mb-6">
              <button
                className={chipClass(showMembers)}
                type="button"
                aria-pressed={showMembers}
                onClick={() => setShowMembers((current) => !current)}
              >
                Show member accounts
              </button>
            </div>
            {visibleProfiles.length === 0 ? (
              <p className="text-sm text-[#A3A3A3]">
                {profiles.length === 0 ? 'No accounts yet.' : 'No owner or staff accounts.'}
              </p>
            ) : (
              <ul className="flex flex-col">
                {visibleProfiles.map((profile) => (
                  <li
                    key={profile.id}
                    className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">
                        {profile.name}
                        <StatusBadge tone={roleTone[profile.role]} className="ml-3">
                          {profile.role}
                        </StatusBadge>
                      </p>
                      <p className="mt-1 text-sm text-[#A3A3A3]">
                        Joined {formatDate(profile.createdAt)} · {profile.email}
                      </p>
                    </div>
                    <RowMenu
                      id={`staff-menu-${profile.id}`}
                      label="More"
                      items={(['owner', 'staff', 'member'] as UserRole[])
                        .filter((role) => role !== profile.role)
                        .map((role) => ({
                          label: `Make ${role}`,
                          danger: profile.role === 'owner' && role !== 'owner',
                          onClick: () => requestRoleChange(profile, role)
                        }))}
                    />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <p className="text-sm text-[#A3A3A3]">
            To add a new staff account, have them sign up at the auth page — then promote them here.
            Owners can manage roles and money records; staff can run check-ins and record payments;
            members can only see their own bookings.
          </p>
        </>
      )}

      {pendingChange ? (
        <ConfirmModal
          title={`Set ${pendingChange.profile.name}'s role to ${pendingChange.role}?`}
          body={
            pendingChange.profile.role === 'owner' && pendingChange.role !== 'owner'
              ? 'They will lose owner capabilities immediately. This cannot be undone from this page.'
              : `They will ${pendingChange.role === 'member' ? 'lose staff access' : 'gain ' + pendingChange.role + ' capabilities'} immediately.`
          }
          confirmLabel={`Make ${pendingChange.role}`}
          pendingLabel="Saving…"
          danger={pendingChange.profile.role === 'owner' && pendingChange.role !== 'owner'}
          pending={saving}
          error={error}
          restoreFocusId={`staff-menu-${pendingChange.profile.id}`}
          onConfirm={() => void handleConfirmRoleChange()}
          onCancel={() => {
            if (!saving) {
              setPendingChange(null);
            }
          }}
        />
      ) : null}
    </PageShell>
  );
}
