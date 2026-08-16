import { FormEvent, useEffect, useState } from 'react';
import { toDataURL } from 'qrcode';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { formatDate, formatWhen, phDateToday } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { HttpMemberAccountRepository } from '../memberAccounts/httpMemberAccountRepository';
import { mockMemberAccountRepository } from '../memberAccounts/memberAccountRepository';
import { mockMemberRepository, type Member, type Membership } from './memberRepository';
import { SupabaseMemberRepository } from './supabaseMemberRepository';
import { mockStaffRepository, type UserRole } from '../staff/staffRepository';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';

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

function membershipState(membership: Membership | null): { tone: 'active' | 'expiring' | 'expired' | 'neutral'; label: string } {
  if (!membership) {
    return { tone: 'expired', label: 'No membership' };
  }
  if (membership.status === 'paused') {
    return { tone: 'neutral', label: `Paused (${membership.planName})` };
  }
  if (membership.status === 'cancelled') {
    return { tone: 'neutral', label: `Cancelled (${membership.planName})` };
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
  const [myRole, setMyRole] = useState<UserRole | null>(null);

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

  const [loginFor, setLoginFor] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginConfirm, setLoginConfirm] = useState('');
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSaving, setLoginSaving] = useState(false);

  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSaving, setLinkSaving] = useState(false);

  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

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
    const loadRole = async () => {
      const roleRepo = hasSupabaseConfig ? new SupabaseStaffRepository() : mockStaffRepository;
      setMyRole(await roleRepo.getMyRole());
    };
    void loadRole();
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
    const activeMembership =
      member.membership && member.membership.status === 'active' ? member.membership : null;
    if (
      member.isActive &&
      !window.confirm(
        activeMembership
          ? `Deactivate ${member.fullName}? They have an active ${activeMembership.planName} (until ${formatDate(activeMembership.endsAt)}) — check-ins will be blocked immediately.`
          : `Deactivate ${member.fullName}? They will no longer be able to check in.`
      )
    ) {
      return;
    }
    const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    try {
      await repo.setMemberActive(member.id, !member.isActive);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update member.');
    }
  };

  const handleMembershipStatus = async (member: Member, status: 'paused' | 'active' | 'cancelled') => {
    const membership = member.membership;
    if (!membership) {
      return;
    }
    const messages: Record<'paused' | 'active' | 'cancelled', string> = {
      paused: `Pause ${member.fullName}'s membership (${membership.planName} until ${formatDate(membership.endsAt)})? Check-ins will be blocked until resumed.`,
      active: `Resume ${member.fullName}'s membership (${membership.planName} until ${formatDate(membership.endsAt)})?`,
      cancelled: `Cancel ${member.fullName}'s membership (${membership.planName} until ${formatDate(membership.endsAt)})? This cannot be undone; a new payment starts a new membership.`
    };
    if (!window.confirm(messages[status])) {
      return;
    }
    const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    try {
      await repo.setMembershipStatus(member.id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update membership.');
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

  const handleToggleLogin = (member: Member) => {
    if (loginFor === member.id) {
      setLoginFor(null);
      setLoginEmail('');
      setLoginPassword('');
      setLoginConfirm('');
      setLoginMessage(null);
      setLoginError(null);
      return;
    }
    setLoginFor(member.id);
    setLoginEmail(member.email ?? '');
    setLoginPassword('');
    setLoginConfirm('');
    setLoginMessage(null);
    setLoginError(null);
  };

  const handleCreateLogin = async (member: Member) => {
    setLoginError(null);
    setLoginMessage(null);

    const email = loginEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginError('Enter a valid email address.');
      return;
    }
    if (loginPassword.length < 6) {
      setLoginError('Password must be at least 6 characters.');
      return;
    }
    if (loginConfirm !== loginPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    const repo = hasSupabaseConfig ? new HttpMemberAccountRepository() : mockMemberAccountRepository;
    setLoginSaving(true);
    try {
      await repo.createLogin({ memberId: member.id, email, password: loginPassword });
      setLoginMessage(`Login created for ${email}. Tell the member to sign in with this email and password.`);
      setLoginEmail('');
      setLoginPassword('');
      setLoginConfirm('');
      await load();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Failed to create the login. Try again.');
    } finally {
      setLoginSaving(false);
    }
  };

  const handleToggleLink = (member: Member) => {
    if (linkFor === member.id) {
      setLinkFor(null);
      setLinkEmail('');
      setLinkMessage(null);
      setLinkError(null);
      return;
    }
    setLinkFor(member.id);
    setLinkEmail(member.email ?? '');
    setLinkMessage(null);
    setLinkError(null);
  };

  const handleLinkAccount = async (member: Member) => {
    setLinkError(null);
    setLinkMessage(null);

    const email = linkEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLinkError('Enter a valid email address.');
      return;
    }

    const repo = hasSupabaseConfig ? new HttpMemberAccountRepository() : mockMemberAccountRepository;
    setLinkSaving(true);
    try {
      await repo.linkAccount({ memberId: member.id, email });
      setLinkMessage(`Linked to ${email.toLowerCase()}. The member can now sign in with this email.`);
      setLinkEmail('');
      await load();
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : 'Failed to link the account. Try again.');
    } finally {
      setLinkSaving(false);
    }
  };

  const handleTogglePin = (member: Member) => {
    if (pinFor === member.id) {
      setPinFor(null);
      setPinValue('');
      setPinError(null);
      setPinMessage(null);
      return;
    }
    setPinFor(member.id);
    setPinValue('');
    setPinError(null);
    setPinMessage(null);
  };

  const handleSavePin = async (member: Member) => {
    if (!/^\d{4,6}$/.test(pinValue)) {
      setPinError('PIN must be 4-6 digits.');
      return;
    }
    const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    setPinSaving(true);
    try {
      await repo.setMemberPin(member.id, pinValue);
      setPinMessage(`PIN saved for ${member.fullName}.`);
      setPinError(null);
      setPinValue('');
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Failed to save PIN.');
    } finally {
      setPinSaving(false);
    }
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
                        Joined {formatWhen(member.joinedAt)}
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
                      {member.userId === null ? (
                        <>
                          <button
                            className={buttonClass}
                            type="button"
                            onClick={() => handleToggleLogin(member)}
                          >
                            {loginFor === member.id ? 'Cancel' : 'Create login'}
                          </button>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            onClick={() => handleToggleLink(member)}
                          >
                            {linkFor === member.id ? 'Cancel' : 'Link existing'}
                          </button>
                        </>
                      ) : null}
                      <button
                        className={buttonClass}
                        type="button"
                        onClick={() => void handleShowQr(member)}
                      >
                        {qrFor === member.id ? 'Hide QR' : 'Show QR'}
                      </button>
                      <button
                        className={ghostButtonClass}
                        type="button"
                        onClick={() => handleTogglePin(member)}
                      >
                        {pinFor === member.id ? 'Cancel' : 'Set PIN'}
                      </button>
                      {myRole === 'owner' || !member.isActive ? (
                        <button
                          className={buttonClass}
                          type="button"
                          onClick={() => void handleToggleActive(member)}
                        >
                          {member.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : null}
                      {member.membership?.status === 'active' ? (
                        <>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            onClick={() => void handleMembershipStatus(member, 'paused')}
                          >
                            Pause
                          </button>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            onClick={() => void handleMembershipStatus(member, 'cancelled')}
                          >
                            Cancel membership
                          </button>
                        </>
                      ) : null}
                      {member.membership?.status === 'paused' ? (
                        <>
                          <button
                            className={buttonClass}
                            type="button"
                            onClick={() => void handleMembershipStatus(member, 'active')}
                          >
                            Resume
                          </button>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            onClick={() => void handleMembershipStatus(member, 'cancelled')}
                          >
                            Cancel membership
                          </button>
                        </>
                      ) : null}
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

                    {loginFor === member.id ? (
                      <div className="flex flex-col gap-4 border border-[#262626] bg-[#1A1A1A] p-4">
                        <p className="text-sm text-[#A3A3A3]">
                          Create a login so this member can sign in, check in, book classes, and see their own
                          statement.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <label className="flex flex-col gap-2 text-sm">
                            <span>Login email</span>
                            <input
                              className={inputClass}
                              type="email"
                              value={loginEmail}
                              onChange={(event) => setLoginEmail(event.target.value)}
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm">
                            <span>Password</span>
                            <input
                              className={inputClass}
                              type="password"
                              value={loginPassword}
                              onChange={(event) => setLoginPassword(event.target.value)}
                            />
                          </label>
                          <label className="flex flex-col gap-2 text-sm">
                            <span>Confirm password</span>
                            <input
                              className={inputClass}
                              type="password"
                              value={loginConfirm}
                              onChange={(event) => setLoginConfirm(event.target.value)}
                            />
                          </label>
                        </div>
                        {loginError ? <p className="text-sm text-[#FF3D00]">{loginError}</p> : null}
                        {loginMessage ? <p className="text-sm text-[#22C55E]">{loginMessage}</p> : null}
                        <div>
                          <button
                            className={buttonClass}
                            type="button"
                            disabled={loginSaving}
                            onClick={() => void handleCreateLogin(member)}
                          >
                            {loginSaving ? 'Creating…' : 'Create login'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {linkFor === member.id ? (
                      <div className="flex flex-col gap-4 border border-[#262626] bg-[#1A1A1A] p-4">
                        <p className="text-sm text-[#A3A3A3]">
                          Link an existing account to this member — use this when they already signed up on
                          their own and have an account, but it is not connected to their member record.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm">
                            <span>Account email</span>
                            <input
                              className={inputClass}
                              type="email"
                              value={linkEmail}
                              onChange={(event) => setLinkEmail(event.target.value)}
                            />
                          </label>
                        </div>
                        {linkError ? <p className="text-sm text-[#FF3D00]">{linkError}</p> : null}
                        {linkMessage ? <p className="text-sm text-[#22C55E]">{linkMessage}</p> : null}
                        <div>
                          <button
                            className={buttonClass}
                            type="button"
                            disabled={linkSaving}
                            onClick={() => void handleLinkAccount(member)}
                          >
                            {linkSaving ? 'Linking…' : 'Link account'}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {pinFor === member.id ? (
                      <div className="flex flex-col gap-4 border border-[#262626] bg-[#1A1A1A] p-4">
                        <p className="text-sm text-[#A3A3A3]">
                          Set a 4-6 digit PIN for {member.fullName}. The front desk asks for it at check-in so a
                          screenshot of their QR code cannot be used to check in as them. Save again to change it.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="flex flex-col gap-2 text-sm">
                            <span>PIN</span>
                            <input
                              className={inputClass}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              maxLength={6}
                              value={pinValue}
                              onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ''))}
                            />
                          </label>
                        </div>
                        {pinError ? <p className="text-sm text-[#FF3D00]">{pinError}</p> : null}
                        {pinMessage ? <p className="text-sm text-[#22C55E]">{pinMessage}</p> : null}
                        <div>
                          <button
                            className={buttonClass}
                            type="button"
                            disabled={pinSaving}
                            onClick={() => void handleSavePin(member)}
                          >
                            {pinSaving ? 'Saving…' : 'Save PIN'}
                          </button>
                        </div>
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