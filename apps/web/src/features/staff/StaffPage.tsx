import { useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { formatDate } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockStaffRepository, type StaffProfile, type UserRole } from './staffRepository';
import { SupabaseStaffRepository } from './supabaseStaffRepository';

const roles: UserRole[] = ['owner', 'staff', 'member'];

const roleTone: Record<UserRole, string> = {
  owner: 'text-[#FF3D00]',
  staff: 'text-[#22C55E]',
  member: 'text-[#737373]'
};

export function StaffPage() {
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    if (!hasSupabaseConfig) {
      setMyRole(await mockStaffRepository.getMyRole());
      setProfiles(await mockStaffRepository.listProfiles());
      setLoading(false);
      return;
    }
    const repo = new SupabaseStaffRepository();
    try {
      const [role, loaded] = await Promise.all([repo.getMyRole(), repo.listProfiles()]);
      setMyRole(role);
      setProfiles(loaded);
    } catch (e) {
      console.warn('Failed to load staff data from Supabase', e);
      setMyRole(await mockStaffRepository.getMyRole());
      setProfiles(await mockStaffRepository.listProfiles());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRoleChange = async (profile: StaffProfile, role: UserRole) => {
    if (!window.confirm(`Set ${profile.name}'s role to ${role}?`)) {
      return;
    }
    setError(null);
    setSaving(profile.id);
    try {
      const repo = hasSupabaseConfig ? new SupabaseStaffRepository() : mockStaffRepository;
      await repo.updateRole(profile.id, role);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <PageShell eyebrow="Management" title="Staff">
      <BackLink to="/app" label="Back to dashboard" />

      {error ? <p className="mb-4 text-sm text-[#FF3D00]">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#737373]">Loading…</p>
      ) : myRole !== 'owner' ? (
        <SectionCard title="Owner access required">
          <p className="text-sm text-[#737373]">
            Only the owner can manage staff accounts and roles.
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Accounts"
            description="Sign-ups appear here automatically. Changing a role takes effect immediately."
          >
            {profiles.length === 0 ? (
              <p className="text-sm text-[#737373]">No accounts yet.</p>
            ) : (
              <ul className="flex flex-col">
                {profiles.map((profile) => (
                  <li
                    key={profile.id}
                    className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">
                        {profile.name}
                        <span
                          className={`ml-3 text-[0.7rem] uppercase tracking-[0.2em] ${roleTone[profile.role]}`}
                        >
                          {profile.role}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-[#737373]">
                        {profile.email} · joined {formatDate(profile.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-[#737373]">Role</span>
                        <select
                          className="border border-[#262626] bg-[#1A1A1A] px-3 py-2 text-sm text-[#FAFAFA] outline-none focus:border-[#FF3D00]"
                          value={profile.role}
                          disabled={saving === profile.id}
                          onChange={(event) =>
                            void handleRoleChange(profile, event.target.value as UserRole)
                          }
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>
                      {saving === profile.id ? (
                        <p className="text-sm text-[#737373]">Saving…</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <p className="text-sm text-[#737373]">
            To add a new staff account, have them sign up at the auth page — then promote them here.
          </p>
        </>
      )}
    </PageShell>
  );
}