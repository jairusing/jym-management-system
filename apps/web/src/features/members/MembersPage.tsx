import { FormEvent, useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate, phDateToday } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockMemberRepository, type Member, type Membership } from './memberRepository';
import { SupabaseMemberRepository } from './supabaseMemberRepository';

const inputClass =
  'border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]';

const buttonClass =
  'inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:opacity-50';

const ghostButtonClass =
  'inline-flex items-center border border-[#262626] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#A3A3A3] transition-all duration-150 hover:text-[#FF3D00] disabled:opacity-50';

const chipClass = (selected: boolean) =>
  `border px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150 ${
    selected ? 'border-[#FF3D00] text-[#FF3D00]' : 'border-[#262626] text-[#A3A3A3] hover:text-[#FAFAFA]'
  }`;

const PAGE_SIZE = 15;

function today() {
  return phDateToday();
}

function membershipState(membership: Membership | null): { tone: 'active' | 'expiring' | 'expired'; label: string } {
  if (!membership) {
    return { tone: 'expired', label: 'No membership' };
  }
  const expiresIn = Math.ceil(
    (new Date(`${membership.endsAt}T23:59:59`).getTime() - new Date(`${today()}T23:59:59`).getTime()) / 86400000
  );
  if (expiresIn < 0) {
    return { tone: 'expired', label: `Expired ${formatDate(membership.endsAt)}` };
  }
  if (expiresIn <= 7) {
    return { tone: 'expiring', label: `Expires ${formatDate(membership.endsAt)}` };
  }
  return { tone: 'active', label: `${membership.planName} until ${formatDate(membership.endsAt)}` };
}

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [membershipFilter, setMembershipFilter] = useState<'any' | 'active' | 'expired' | 'none'>('any');
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, membershipFilter]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredMembers = members.filter((member) => {
    if (
      normalizedSearch &&
      !member.fullName.toLowerCase().includes(normalizedSearch) &&
      !(member.phone ?? '').toLowerCase().includes(normalizedSearch) &&
      !(member.email ?? '').toLowerCase().includes(normalizedSearch)
    ) {
      return false;
    }
    if (statusFilter === 'active' && !member.isActive) {
      return false;
    }
    if (statusFilter === 'inactive' && member.isActive) {
      return false;
    }
    if (membershipFilter === 'active' && (!member.membership || membershipState(member.membership).tone === 'expired')) {
      return false;
    }
    if (membershipFilter === 'expired' && (!member.membership || membershipState(member.membership).tone !== 'expired')) {
      return false;
    }
    if (membershipFilter === 'none' && member.membership) {
      return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleMembers = filteredMembers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
          <p className="text-sm text-[#A3A3A3]">Loading…</p>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-3">
              <input
                className={inputClass}
                type="search"
                placeholder="Search by name, phone, or email…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className={chipClass(statusFilter === 'all')}
                  type="button"
                  aria-label="Filter: All"
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </button>
                <button
                  className={chipClass(statusFilter === 'active')}
                  type="button"
                  aria-label="Filter: Active"
                  onClick={() => setStatusFilter('active')}
                >
                  Active
                </button>
                <button
                  className={chipClass(statusFilter === 'inactive')}
                  type="button"
                  aria-label="Filter: Inactive"
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inactive
                </button>
                <select
                  className={inputClass}
                  aria-label="Filter by membership"
                  value={membershipFilter}
                  onChange={(event) => setMembershipFilter(event.target.value as typeof membershipFilter)}
                >
                  <option value="any">Any membership</option>
                  <option value="active">Active membership</option>
                  <option value="expired">Expired membership</option>
                  <option value="none">No membership</option>
                </select>
              </div>
            </div>

            {filteredMembers.length === 0 ? (
              <p className="text-sm text-[#A3A3A3]">
                {members.length === 0
                  ? 'No members yet. Add your first member above.'
                  : 'No members match your filters.'}
              </p>
            ) : (
              <ul className="flex flex-col">
                {visibleMembers.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-col gap-4 border-b border-[#262626] py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-medium text-[#FAFAFA]">
                        {member.fullName}
                        <StatusBadge tone={member.isActive ? 'good' : 'bad'} className="ml-3">
                          {member.isActive ? 'Active' : 'Inactive'}
                        </StatusBadge>
                      </p>
                      <p className="mt-1 text-sm text-[#A3A3A3]">
                        Joined {formatDate(member.joinedAt)}
                        {member.phone ? ` · ${member.phone}` : ''}
                        {member.email ? ` · ${member.email}` : ''}
                      </p>
                      <p
                        className={`mt-1 text-sm ${
                          membershipState(member.membership).tone === 'expired'
                            ? 'font-semibold text-[#FF3D00]'
                            : membershipState(member.membership).tone === 'expiring'
                              ? 'text-[#FFB300]'
                              : 'text-[#A3A3A3]'
                        }`}
                      >
                        {membershipState(member.membership).label}
                      </p>
                      {member.notes ? <p className="mt-1 text-sm text-[#A3A3A3]">{member.notes}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 whitespace-nowrap">
                      <a className={buttonClass} href={`/app/members/${member.id}`}>
                        Statement
                      </a>
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
                        className={`${buttonClass} border-[#262626] text-[#A3A3A3] hover:text-[#FF3D00]`}
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
                          <p className="text-sm text-[#A3A3A3]">Generating…</p>
                        )}
                        <p className="text-sm text-[#A3A3A3]">Member ID: {member.id}</p>
                        <p className="text-sm text-[#A3A3A3]">Show this QR at the front desk for check-in.</p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <p className="text-sm text-[#A3A3A3]">
                {filteredMembers.length === 0
                  ? '0 results'
                  : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredMembers.length)} of ${filteredMembers.length}`}
              </p>
              <div className="flex gap-2">
                <button
                  className={ghostButtonClass}
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Prev
                </button>
                <button
                  className={ghostButtonClass}
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </SectionCard>
    </PageShell>
  );
}