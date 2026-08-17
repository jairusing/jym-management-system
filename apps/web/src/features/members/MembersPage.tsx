import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  KeyRound,
  Link2,
  Pause,
  Play,
  QrCode,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  XCircle
} from 'lucide-react';
import { toDataURL } from 'qrcode';
import { BackLink } from '../../components/ui/BackLink';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { PageShell } from '../../components/ui/PageShell';
import { RowMenu } from '../../components/ui/RowMenu';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  chipClass,
  ghostButtonClass,
  inputClass,
  primaryButtonClass
} from '../../components/ui/buttonClasses';
import { formatDate, formatWhen, phDateToday } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { HttpMemberAccountRepository } from '../memberAccounts/httpMemberAccountRepository';
import { mockMemberAccountRepository } from '../memberAccounts/memberAccountRepository';
import { mockMemberRepository, type Member, type Membership } from './memberRepository';
import { SupabaseMemberRepository } from './supabaseMemberRepository';
import { mockStaffRepository, type UserRole } from '../staff/staffRepository';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';

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

type PendingConfirm = {
  title: string;
  body: string;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
};

export function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null);
  const confirmTriggerRef = useRef<HTMLElement | null>(null);
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
    setLoadError(null);
    try {
      setMembers(await repo.listMembers());
    } catch (e) {
      console.warn('Failed to load members from Supabase', e);
      setMembers([]);
      setLoadError(e instanceof Error ? e.message : 'Failed to load members.');
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
    if (!member.isActive) {
      const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
      try {
        await repo.setMemberActive(member.id, true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update member.');
      }
      return;
    }
    const activeMembership =
      member.membership && member.membership.status === 'active' ? member.membership : null;
    confirmTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingConfirm({
      title: `Deactivate ${member.fullName}?`,
      body: activeMembership
        ? `They have an active ${activeMembership.planName} (until ${formatDate(activeMembership.endsAt)}) — check-ins will be blocked immediately.`
        : 'They will no longer be able to check in.',
      confirmLabel: 'Deactivate',
      pendingLabel: 'Deactivating…',
      danger: true,
      run: async () => {
        const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
        await repo.setMemberActive(member.id, false);
        await load();
      }
    });
  };

  const handleMembershipStatus = async (member: Member, status: 'paused' | 'active' | 'cancelled') => {
    const membership = member.membership;
    if (!membership) {
      return;
    }
    const messages: Record<'paused' | 'active' | 'cancelled', string> = {
      paused: `Pause ${member.fullName}'s membership? ${membership.planName} until ${formatDate(membership.endsAt)}. Check-ins will be blocked until resumed.`,
      active: `Resume ${member.fullName}'s membership? ${membership.planName} until ${formatDate(membership.endsAt)}.`,
      cancelled: `Cancel ${member.fullName}'s membership? ${membership.planName} until ${formatDate(membership.endsAt)}. This cannot be undone — a new payment starts a new membership.`
    };
    const labels: Record<'paused' | 'active' | 'cancelled', string> = {
      paused: 'Pause',
      active: 'Resume',
      cancelled: 'Cancel membership'
    };
    confirmTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingConfirm({
      title: messages[status],
      body: status === 'cancelled'
        ? 'The member will be blocked from check-in. A new payment starts a fresh membership.'
        : '',
      confirmLabel: labels[status],
      pendingLabel: labels[status] === 'Cancel membership' ? 'Cancelling…' : `${labels[status]}ing…`,
      danger: status === 'cancelled',
      run: async () => {
        const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
        await repo.setMembershipStatus(member.id, status);
        await load();
      }
    });
  };

  const handleDelete = async (member: Member) => {
    confirmTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPendingConfirm({
      title: `Delete ${member.fullName}?`,
      body: 'This cannot be undone — their record, membership, and check-in history are removed permanently.',
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
      danger: true,
      run: async () => {
        const repo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
        await repo.deleteMember(member.id);
        await load();
      }
    });
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
    setLoginFor(null);
    setLinkFor(null);
    setPinFor(null);
    try {
      const dataUrl = await toDataURL(member.id, { width: 160, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch (e) {
      console.warn('Failed to generate QR code', e);
      setQrDataUrl('error');
    }
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
    setQrFor(null);
    setQrDataUrl(null);
    setLinkFor(null);
    setPinFor(null);
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
    setQrFor(null);
    setQrDataUrl(null);
    setLoginFor(null);
    setPinFor(null);
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
    setQrFor(null);
    setQrDataUrl(null);
    setLoginFor(null);
    setLinkFor(null);
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

  const openPanel = qrFor ?? loginFor ?? linkFor ?? pinFor;
  useEffect(() => {
    if (openPanel) {
      const reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document
        .getElementById(`member-panel-${openPanel}`)
        ?.scrollIntoView?.({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }, [openPanel]);

  const restoreConfirmFocus = () => {
    const trigger = confirmTriggerRef.current;
    if (trigger && trigger.isConnected) {
      trigger.focus?.();
    }
    confirmTriggerRef.current = null;
  };

  const handleCancelConfirm = () => {
    if (!confirmPending) {
      setConfirmError(null);
      setPendingConfirm(null);
      restoreConfirmFocus();
    }
  };

  const handleConfirm = async () => {
    const current = pendingConfirm;
    if (!current) {
      return;
    }
    setConfirmPending(true);
    setConfirmError(null);
    try {
      await current.run();
      setPendingConfirm(null);
      restoreConfirmFocus();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setConfirmPending(false);
    }
  };

  return (
    <PageShell
      eyebrow="Management"
      title="Members"
      description="Register and manage your gym members."
    >
      <BackLink to="/app" label="Back to dashboard" />

      <SectionCard title="All members" description={`${members.length} registered member${members.length === 1 ? '' : 's'}.`}>
        {loadError ? (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-[#FF3D00]">{loadError}</p>
            <button className={primaryButtonClass} type="button" onClick={() => void load()}>
              Retry
            </button>
          </div>
        ) : loading ? (
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
                  ? 'No members yet. Add your first member below.'
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
                        {member.membership?.status === 'paused' ? (
                          <StatusBadge tone="warning" className="ml-3">
                            Paused
                          </StatusBadge>
                        ) : (
                          <StatusBadge tone={member.isActive ? 'good' : 'bad'} className="ml-3">
                            {member.isActive ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        )}
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
<div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                      <a className={ghostButtonClass} href={`/app/members/${member.id}`}>
                        Statement
                      </a>
                      <RowMenu
                        open={openMenuFor === member.id}
                        onOpenChange={(next) => setOpenMenuFor(next ? member.id : null)}
                        items={[
                          {
                            label: qrFor === member.id ? 'Hide QR' : 'Show QR',
                            icon: QrCode,
                            onClick: () => void handleShowQr(member)
                          },
                          {
                            label: 'Set PIN',
                            icon: KeyRound,
                            onClick: () => handleTogglePin(member)
                          },
                          ...(member.userId === null
                            ? [
                                {
                                  label: 'Create login',
                                  icon: UserPlus,
                                  divider: true,
                                  onClick: () => handleToggleLogin(member)
                                },
                                {
                                  label: 'Link existing',
                                  icon: Link2,
                                  onClick: () => handleToggleLink(member)
                                }
                              ]
                            : []),
                          ...(member.membership?.status === 'active'
                            ? [
                                {
                                  label: 'Pause',
                                  icon: Pause,
                                  divider: true,
                                  onClick: () => void handleMembershipStatus(member, 'paused')
                                },
                                {
                                  label: 'Cancel membership',
                                  icon: XCircle,
                                  danger: true,
                                  onClick: () => void handleMembershipStatus(member, 'cancelled')
                                }
                              ]
                            : member.membership?.status === 'paused'
                              ? [
                                  {
                                    label: 'Resume',
                                    icon: Play,
                                    divider: true,
                                    onClick: () => void handleMembershipStatus(member, 'active')
                                  },
                                  {
                                    label: 'Cancel membership',
                                    icon: XCircle,
                                    danger: true,
                                    onClick: () => void handleMembershipStatus(member, 'cancelled')
                                  }
                                ]
                              : []),
                          ...(myRole === 'owner' || !member.isActive
                            ? [
                                {
                                  label: member.isActive ? 'Deactivate' : 'Activate',
                                  icon: member.isActive ? UserX : UserCheck,
                                  divider: true,
                                  onClick: () => void handleToggleActive(member)
                                }
                              ]
                            : []),
                          {
                            label: 'Delete',
                            icon: Trash2,
                            danger: true,
                            divider: true,
                            onClick: () => void handleDelete(member)
                          }
                        ]}
                      />
                    </div>

                    {qrFor === member.id ? (
                      <div
                        id={`member-panel-${member.id}`}
                        className="flex scroll-mt-4 flex-col items-start gap-2 border border-[#262626] bg-[#1A1A1A] p-4"
                      >
                        {qrDataUrl === 'error' ? (
                          <p className="text-sm text-[#FF3D00]">Could not generate the QR code.</p>
                        ) : qrDataUrl ? (
                          <img src={qrDataUrl} alt={`QR code for ${member.fullName}`} className="h-40 w-40" />
                        ) : (
                          <p className="text-sm text-[#A3A3A3]">Generating…</p>
                        )}
                        <p className="text-sm text-[#A3A3A3]">Member ID: {member.id}</p>
                        <p className="text-sm text-[#A3A3A3]">Show this QR at the front desk for check-in.</p>
                      </div>
                    ) : null}

                    {loginFor === member.id ? (
                      <div id={`member-panel-${member.id}`} className="flex scroll-mt-4 flex-col gap-4 border border-[#262626] bg-[#1A1A1A] p-4">
                        <p className="text-sm text-[#A3A3A3]">
                          Create a login so this member can sign in, check in, book classes, and see their own
                          statement.
                        </p>
                        <form
                          className="flex flex-col gap-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleCreateLogin(member);
                          }}
                        >
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
                              className={primaryButtonClass}
                              type="submit"
                              disabled={loginSaving}
                            >
                              {loginSaving ? 'Creating…' : 'Create login'}
                            </button>
                            <button
                              className={ghostButtonClass}
                              type="button"
                              onClick={() => handleToggleLogin(member)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}

                    {linkFor === member.id ? (
                      <div id={`member-panel-${member.id}`} className="flex scroll-mt-4 flex-col gap-4 border border-[#262626] bg-[#1A1A1A] p-4">
                        <p className="text-sm text-[#A3A3A3]">
                          Link an existing account to this member — use this when they already signed up on
                          their own and have an account, but it is not connected to their member record.
                        </p>
                        <form
                          className="flex flex-col gap-4"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleLinkAccount(member);
                          }}
                        >
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
                              className={primaryButtonClass}
                              type="submit"
                              disabled={linkSaving}
                            >
                              {linkSaving ? 'Linking…' : 'Link account'}
                            </button>
                            <button
                              className={ghostButtonClass}
                              type="button"
                              onClick={() => handleToggleLink(member)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    ) : null}

                    {pinFor === member.id ? (
                      <div id={`member-panel-${member.id}`} className="flex scroll-mt-4 flex-col gap-4 border border-[#262626] bg-[#1A1A1A] p-4">
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
                              autoFocus
                              maxLength={6}
                              value={pinValue}
                              onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ''))}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void handleSavePin(member);
                                }
                              }}
                            />
                          </label>
                        </div>
                        {pinError ? <p className="text-sm text-[#FF3D00]">{pinError}</p> : null}
                        {pinMessage ? <p className="text-sm text-[#22C55E]">{pinMessage}</p> : null}
                        <div>
                          <button
                            className={primaryButtonClass}
                            type="button"
                            disabled={pinSaving}
                            onClick={() => void handleSavePin(member)}
                          >
                            {pinSaving ? 'Saving…' : 'Save PIN'}
                          </button>
                          <button
                            className={ghostButtonClass}
                            type="button"
                            disabled={pinSaving}
                            onClick={() => handleTogglePin(member)}
                          >
                            Cancel
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
            <button className={primaryButtonClass} type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add member'}
            </button>
          </div>
        </form>
      </SectionCard>

      {pendingConfirm ? (
        <ConfirmModal
          title={pendingConfirm.title}
          body={pendingConfirm.body}
          confirmLabel={pendingConfirm.confirmLabel}
          pendingLabel={pendingConfirm.pendingLabel}
          danger={pendingConfirm.danger}
          pending={confirmPending}
          error={confirmError}
          onCancel={handleCancelConfirm}
          onConfirm={() => void handleConfirm()}
        />
      ) : null}
    </PageShell>
  );
}