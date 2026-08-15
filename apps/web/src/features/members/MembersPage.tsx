import { FormEvent, useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { formatDate, phDateToday } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockMemberRepository, type Member } from './memberRepository';
import { SupabaseMemberRepository } from './supabaseMemberRepository';

const inputClass =
  'border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]';

const buttonClass =
  'inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:opacity-50';

function today() {
  return phDateToday();
}

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [joinedAt, setJoinedAt] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!hasSupabaseConfig) {
      setMembers(await mockMemberRepository.listMembers());
      setLoading(false);
      return;
    }
    const repo = new SupabaseMemberRepository();
    try {
      setMembers(await repo.listMembers());
    } catch (e) {
      console.warn('Failed to load members from Supabase', e);
      setMembers(await mockMemberRepository.listMembers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Member name is required.');
      return;
    }

    const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    setSaving(true);
    try {
      await repo.createMember({
        fullName,
        email,
        phone,
        joinedAt,
        notes
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setJoinedAt(today());
      setNotes('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add member.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: Member) => {
    const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    try {
      await repo.setMemberActive(member.id, !member.isActive);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update member.');
    }
  };

  const handleDelete = async (member: Member) => {
    if (!window.confirm(`Delete ${member.fullName}? This cannot be undone.`)) {
      return;
    }
    const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    try {
      await repo.deleteMember(member.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete member.');
    }
  };

  const handleShowQr = async (member: Member) => {
    if (qrFor === member.id) {
      setQrFor(null);
      setQrDataUrl(null);
      return;
    }
    setQrFor(member.id);
    setQrDataUrl(null);
    setError(null);
    const dataUrl = await toDataURL(member.id, { width: 160, margin: 1 });
    setQrDataUrl(dataUrl);
  };

  return (
    <PageShell
      eyebrow="Management"
      title="Members"
      description="Register and manage your gym members."
    >
      <BackLink to="/app" label="Back to dashboard" />

      <SectionCard title="Add member" description="Register a new member (walk-ins can be added without an account).">
        <form className="flex flex-col gap-4" onSubmit={handleCreate}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span>Full name</span>
              <input
                className={inputClass}
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Email</span>
              <input
                className={inputClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Phone</span>
              <input
                className={inputClass}
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Joined date</span>
              <input
                className={inputClass}
                type="date"
                value={joinedAt}
                onChange={(event) => setJoinedAt(event.target.value)}
                required
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm">
            <span>Notes</span>
            <input
              className={inputClass}
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}

          <div>
            <button className={buttonClass} type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="All members" description={`${members.length} registered member${members.length === 1 ? '' : 's'}.`}>
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-[#737373]">No members yet. Add your first member above.</p>
        ) : (
          <ul className="flex flex-col">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-col gap-4 border-b border-[#262626] py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-base font-medium text-[#FAFAFA]">
                    {member.fullName}
                    <span
                      className={`ml-3 text-[0.7rem] uppercase tracking-[0.2em] ${
                        member.isActive ? 'text-[#737373]' : 'text-[#FF3D00]'
                      }`}
                    >
                      {member.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-[#737373]">
                    Joined {formatDate(member.joinedAt)}
                    {member.phone ? ` · ${member.phone}` : ''}
                    {member.email ? ` · ${member.email}` : ''}
                  </p>
                  {member.membership ? (
                    <p className="mt-1 text-sm text-[#737373]">
                      {member.membership.planName} until {formatDate(member.membership.endsAt)}
                    </p>
                  ) : null}
                  {member.notes ? <p className="mt-1 text-sm text-[#737373]">{member.notes}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={buttonClass}
                    type="button"
                    onClick={() => void handleShowQr(member)}
                  >
                    {qrFor === member.id ? 'Hide QR' : 'Show QR'}
                  </button>
                  <button
                    className={buttonClass}
                    type="button"
                    onClick={() => void handleToggleActive(member)}
                  >
                    {member.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className={`${buttonClass} border-[#262626] text-[#737373] hover:text-[#FF3D00]`}
                    type="button"
                    onClick={() => void handleDelete(member)}
                  >
                    Delete
                  </button>
                </div>

                {qrFor === member.id ? (
                  <div className="flex flex-col items-start gap-2 border border-[#262626] bg-[#1A1A1A] p-4">
                    {qrDataUrl ? (
                      <img src={qrDataUrl} alt={`QR code for ${member.fullName}`} className="h-40 w-40" />
                    ) : (
                      <p className="text-sm text-[#737373]">Generating…</p>
                    )}
                    <p className="text-sm text-[#737373]">Member ID: {member.id}</p>
                    <p className="text-sm text-[#737373]">Show this QR at the front desk for check-in.</p>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageShell>
  );
}