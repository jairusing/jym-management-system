import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Tabs } from '../../components/ui/Tabs';
import { dangerButtonClass, ghostButtonClass, inputClass, primaryButtonClass } from '../../components/ui/buttonClasses';
import { formatDate, formatDateTime, phDateAfter, phDateInDays, phDateToday, phDayEndUtc, phDayStartUtc } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { toAttendanceCsv } from './attendanceCsv';
import { QrScanner } from './QrScanner';
import { mockCheckInRepository, type CheckIn } from './checkInRepository';
import { SupabaseCheckInRepository } from './supabaseCheckInRepository';
import { mockMemberRepository, type Member } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

const RECENT_COUNT = 5;
const TODAY_LIST_CAP = 10;
const HISTORY_CAP = 200;

function StatusLine({ error, success }: { error: string | null; success: string | null }) {
  return (
    <>
      {error ? <p role="alert" className="mb-4 text-sm text-[#FF3D00]">{error}</p> : null}
      {success ? <p role="status" className="mb-4 text-sm text-[#FAFAFA]">{success}</p> : null}
    </>
  );
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 border border-[#262626] bg-[#0F0F0F] p-4">
      <p role="alert" className="text-sm text-[#FF3D00]">
        Couldn't load check-in data. {message}
      </p>
      <button className={ghostButtonClass} type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

export function CheckInsPage() {
  const [tab, setTab] = useState<'checkin' | 'today' | 'history'>('checkin');
  const [members, setMembers] = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [historyFrom, setHistoryFrom] = useState(phDateInDays(-7));
  const [historyTo, setHistoryTo] = useState(phDateToday());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [qrCheckingIn, setQrCheckingIn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CheckIn | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinSource, setPinSource] = useState<'manual' | 'qr'>('manual');
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  const showError = (message: string) => {
    setSuccess(null);
    setError(message);
  };

  const showSuccess = (message: string) => {
    setError(null);
    setSuccess(message);
  };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    if (!hasSupabaseConfig) {
      setMembers(await mockMemberRepository.listMembers());
      setCheckIns(await mockCheckInRepository.listTodayCheckIns());
      setLoading(false);
      return;
    }
    const memberRepo = new SupabaseMemberRepository();
    const checkInRepo = new SupabaseCheckInRepository();
    try {
      const [loadedMembers, loadedCheckIns] = await Promise.all([
        memberRepo.listMembers(),
        checkInRepo.listTodayCheckIns()
      ]);
      setMembers(loadedMembers);
      setCheckIns(loadedCheckIns);
    } catch (e) {
      console.warn('Failed to load check-in data from Supabase', e);
      setLoadError(e instanceof Error ? e.message : 'Failed to load check-in data.');
      setMembers([]);
      setCheckIns([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = useCallback(async () => {
    if (!historyFrom || !historyTo || historyFrom > historyTo) {
      return;
    }
    setHistoryLoading(true);
    try {
      const repo = hasSupabaseConfig ? new SupabaseCheckInRepository() : mockCheckInRepository;
      setHistory(await repo.listCheckIns(phDayStartUtc(historyFrom), phDayEndUtc(historyTo)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attendance history.');
      setSuccess(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFrom, historyTo]);

  useEffect(() => {
    void load();
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!pinFor) {
      return;
    }
    const panel = document.getElementById('pin-panel');
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel?.scrollIntoView?.({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [pinFor]);

  const handleExportCsv = () => {
    if (history.length === 0) {
      return;
    }
    const csv = toAttendanceCsv(history);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-${historyFrom}-to-${historyTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const GRACE_DAYS = 3;

const membershipExpiry = (member: Member): { blocked: boolean; message: string } | null => {
    const membership = member.membership;
    if (!membership) {
      return null;
    }
    if (membership.status === 'paused') {
      return { blocked: true, message: 'Membership is paused.' };
    }
    if (membership.status === 'cancelled') {
      return { blocked: true, message: 'Membership was cancelled.' };
    }
    if (membership.endsAt >= phDateToday()) {
      return null;
    }
    const graceEnd = phDateAfter(membership.endsAt, GRACE_DAYS);
    if (phDateToday() <= graceEnd) {
      return {
        blocked: false,
        message: `Membership expired ${formatDate(membership.endsAt)} — in ${GRACE_DAYS}-day grace until ${formatDate(graceEnd)}. Renew soon.`
      };
    }
    return {
      blocked: true,
      message: `Membership expired ${formatDate(membership.endsAt)}. Renew before checking in.`
    };
  };

  const refreshTodayCheckIns = async () => {
    setCheckIns(
      hasSupabaseConfig
        ? await new SupabaseCheckInRepository().listTodayCheckIns()
        : await mockCheckInRepository.listTodayCheckIns()
    );
  };

  const handleCheckIn = async (member: Member) => {
    await beginCheckIn(member, 'manual');
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const handleQrCheckIn = async (code: string) => {
    const id = code.trim();
    if (!id) {
      showError('Enter a member ID.');
      return;
    }
    const member = members.find((candidate) => candidate.id === id);
    if (!member) {
      showError('No member matches that ID.');
      return;
    }
    await beginCheckIn(member, 'qr');
  };

  const beginCheckIn = async (member: Member, method: 'manual' | 'qr') => {
    if (checkIns.some((checkIn) => checkIn.memberId === member.id)) {
      showError(`${member.fullName} is already checked in today.`);
      return;
    }
    if (!member.isActive) {
      showError('Cannot check in an inactive member.');
      return;
    }
    const expired = membershipExpiry(member);
    if (expired?.blocked) {
      showError(expired.message);
      return;
    }
    setError(null);
    setSuccess(null);
    if (method === 'manual') {
      setCheckingInId(member.id);
    } else {
      setQrCheckingIn(true);
    }
    const memberRepo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    try {
      const status = await memberRepo.verifyMemberPin(member.id, '');
      if (status === 'missing') {
        await completeCheckIn(member, method);
        return;
      }
      setPinFor(member.id);
      setPinSource(method);
      setPinValue('');
      setPinError(null);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to check in member.');
    } finally {
      setCheckingInId(null);
      setQrCheckingIn(false);
    }
  };

  const completeCheckIn = async (member: Member, method: 'manual' | 'qr') => {
    const repo = hasSupabaseConfig ? new SupabaseCheckInRepository() : mockCheckInRepository;
    try {
      await repo.recordCheckIn({ memberId: member.id, memberName: member.fullName, method });
      showSuccess(method === 'qr' ? `${member.fullName} checked in via QR.` : `${member.fullName} checked in.`);
      if (method === 'qr') {
        setQrCode('');
      }
      await refreshTodayCheckIns();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Failed to check in member.');
    }
  };

  const handleSubmitPin = async () => {
    if (pinFor === null) {
      return;
    }
    const member = members.find((candidate) => candidate.id === pinFor);
    if (!member) {
      setPinError('Member no longer exists.');
      return;
    }
    setPinSaving(true);
    setPinError(null);
    const memberRepo = hasSupabaseConfig ? new SupabaseMemberRepository() : mockMemberRepository;
    try {
      const status = await memberRepo.verifyMemberPin(member.id, pinValue);
      if (status === 'ok' || status === 'missing') {
        const method = pinSource;
        setPinFor(null);
        setPinValue('');
        await completeCheckIn(member, method);
      } else {
        setPinError('Incorrect PIN.');
      }
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'Failed to verify PIN.');
    } finally {
      setPinSaving(false);
    }
  };

  const handleDeleteCheckIn = (checkIn: CheckIn) => {
    setPendingDelete(checkIn);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    const checkIn = pendingDelete;
    if (!checkIn) {
      return;
    }
    setDeletePending(true);
    setDeleteError(null);
    const repo = hasSupabaseConfig ? new SupabaseCheckInRepository() : mockCheckInRepository;
    try {
      await repo.deleteCheckIn(checkIn.id);
      setPendingDelete(null);
      showSuccess('Check-in deleted.');
      await refreshTodayCheckIns();
      await loadHistory();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete check-in.');
    } finally {
      setDeletePending(false);
    }
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filteredMembers = members.filter(
    (member) =>
      member.fullName.toLowerCase().includes(normalizedQuery) ||
      (member.phone ?? '').toLowerCase().includes(normalizedQuery) ||
      (member.email ?? '').toLowerCase().includes(normalizedQuery)
  );
  const recentMembers = members.slice(0, RECENT_COUNT);
  const shownCheckIns = checkIns.slice(0, TODAY_LIST_CAP);
  const shownHistory = history.slice(0, HISTORY_CAP);

  return (
    <PageShell
      eyebrow="Management"
      title="Check-ins"
      description="Search a member and record their visit."
    >
      <BackLink to="/app" label="Back to dashboard" />

      <Tabs
        tabs={[
          { id: 'checkin', label: 'Check in' },
          { id: 'today', label: 'Today' },
          { id: 'history', label: 'History' }
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'checkin' | 'today' | 'history')}
      />

      {tab === 'checkin' ? (
        <SectionCard
          title="Check in a member"
          description="Find the member by name, scan their QR, or enter the QR member ID."
        >
          <StatusLine error={error} success={success} />

          {loadError ? (
            <LoadError message={loadError} onRetry={() => void load()} />
          ) : (
            <>
          <form
            aria-label="QR check-in"
            className="flex flex-col gap-4 pb-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleQrCheckIn(qrCode);
            }}
          >
            <label className="flex flex-col gap-2 text-sm">
              <span>QR code or member ID</span>
              <input
                className={inputClass}
                type="text"
                placeholder="Scan or paste the member ID…"
                value={qrCode}
                onChange={(event) => setQrCode(event.target.value)}
              />
            </label>
            <div className="flex flex-col gap-4 sm:flex-row">
              <button className={primaryButtonClass} type="button" onClick={() => setScanning(true)}>
                Scan QR
              </button>
              <button className={ghostButtonClass} type="button" disabled={qrCheckingIn} onClick={() => void handleQrCheckIn(qrCode)}>
                {qrCheckingIn ? 'Checking in…' : 'Check in via QR'}
              </button>
            </div>
          </form>

          <form
            aria-label="Search members"
            className="flex flex-col gap-4 border-t border-[#262626] pt-4"
            onSubmit={handleSearch}
          >
            <label className="flex flex-col gap-2 text-sm">
              <span>Search members</span>
              <input
                className={inputClass}
                type="search"
                placeholder="Type a name…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            {loading ? (
              <p className="text-sm text-[#A3A3A3]">Loading…</p>
            ) : normalizedQuery ? (
              filteredMembers.length === 0 ? (
                <p className="text-sm text-[#A3A3A3]">No members match that name.</p>
              ) : (
                <ul className="flex flex-col">
                  {filteredMembers.map((member) => {
                    const expired = membershipExpiry(member);
                    const checkedInToday = checkIns.some((checkIn) => checkIn.memberId === member.id);
                    return (
                      <li
                        key={member.id}
                        className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-base font-medium text-[#FAFAFA]">
                            {member.fullName}
                            {checkedInToday ? (
                              <StatusBadge tone="good" className="ml-3">
                                Checked in today
                              </StatusBadge>
                            ) : null}
                            {member.isActive ? null : (
                              <StatusBadge tone="bad" className="ml-3">
                                Inactive
                              </StatusBadge>
                            )}
                            {expired ? (
                              <StatusBadge tone="bad" className="ml-3">
                                {member.membership?.status === 'paused'
                                  ? 'Paused'
                                  : member.membership?.status === 'cancelled'
                                    ? 'Cancelled'
                                    : 'Expired'}
                              </StatusBadge>
                            ) : null}
                          </p>
                          <p className="mt-1 text-sm text-[#A3A3A3]">
                            {member.phone ? member.phone : member.email ? member.email : 'No contact on file'}
                          </p>
                          {expired && !expired.blocked ? (
                            <p className="mt-1 text-xs text-[#FF3D00]">{expired.message}</p>
                          ) : null}
                        </div>
                        {checkedInToday ? null : (
                          <button
                            className={primaryButtonClass}
                            type="button"
                            disabled={!member.isActive || expired?.blocked || checkingInId === member.id}
                            onClick={() => void handleCheckIn(member)}
                          >
                            {checkingInId === member.id ? 'Checking in…' : 'Check in'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )
            ) : members.length === 0 ? (
              <p className="text-sm text-[#A3A3A3]">No members yet. Add members first.</p>
            ) : (
              <div>
                <p className="text-sm text-[#A3A3A3]">
                  Showing the {RECENT_COUNT} most recent members — type to search, then press Check in.
                </p>
                <ul className="mt-2 flex flex-col">
                  {recentMembers.map((member) => {
                    const expired = membershipExpiry(member);
                    const checkedInToday = checkIns.some((checkIn) => checkIn.memberId === member.id);
                    return (
                      <li
                        key={member.id}
                        className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-base font-medium text-[#FAFAFA]">
                            {member.fullName}
                            {checkedInToday ? (
                              <StatusBadge tone="good" className="ml-3">
                                Checked in today
                              </StatusBadge>
                            ) : null}
                            {member.isActive ? null : (
                              <StatusBadge tone="bad" className="ml-3">
                                Inactive
                              </StatusBadge>
                            )}
                            {expired ? (
                              <StatusBadge tone="bad" className="ml-3">
                                {member.membership?.status === 'paused'
                                  ? 'Paused'
                                  : member.membership?.status === 'cancelled'
                                    ? 'Cancelled'
                                    : 'Expired'}
                              </StatusBadge>
                            ) : null}
                          </p>
                          <p className="mt-1 text-sm text-[#A3A3A3]">
                            {member.phone ? member.phone : member.email ? member.email : 'No contact on file'}
                          </p>
                          {expired && !expired.blocked ? (
                            <p className="mt-1 text-xs text-[#FF3D00]">{expired.message}</p>
                          ) : null}
                        </div>
                        {checkedInToday ? null : (
                          <button
                            className={primaryButtonClass}
                            type="button"
                            disabled={!member.isActive || expired?.blocked || checkingInId === member.id}
                            onClick={() => void handleCheckIn(member)}
                          >
                            {checkingInId === member.id ? 'Checking in…' : 'Check in'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </form>
            </>
          )}

          {pinFor ? (
            <div id="pin-panel" className="mt-4 flex flex-col gap-4 border border-[#FFB300] bg-[#1A1A1A] p-4">
              <p className="text-sm font-medium text-[#FAFAFA]">
                Enter the PIN for {members.find((candidate) => candidate.id === pinFor)?.fullName ?? 'this member'}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm">
                  <span>PIN</span>
                  <input
                    className={inputClass}
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    maxLength={6}
                    value={pinValue}
                    onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ''))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSubmitPin();
                      }
                    }}
                  />
                </label>
              </div>
              {pinError ? <p className="text-sm text-[#FF3D00]">{pinError}</p> : null}
              <div className="flex flex-wrap gap-2">
                <button className={primaryButtonClass} type="button" disabled={pinSaving} onClick={() => void handleSubmitPin()}>
                  {pinSaving ? 'Verifying…' : 'Verify PIN'}
                </button>
                <button
                  className={ghostButtonClass}
                  type="button"
                  disabled={pinSaving}
                  onClick={() => {
                    setPinFor(null);
                    setPinValue('');
                    setPinError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </SectionCard>
      ) : tab === 'today' ? (
        <SectionCard
          title="Today's check-ins"
          description={`${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'} today.`}
        >
          <StatusLine error={error} success={success} />

          {loading ? (
            <p className="text-sm text-[#A3A3A3]">Loading…</p>
          ) : loadError ? (
            <LoadError message={loadError} onRetry={() => void load()} />
          ) : checkIns.length === 0 ? (
            <p className="text-sm text-[#A3A3A3]">No check-ins yet today.</p>
          ) : (
            <ul className="flex flex-col">
              {shownCheckIns.map((checkIn) => (
                <li
                  key={checkIn.id}
                  className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-base font-medium text-[#FAFAFA]">{checkIn.memberName}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-[#A3A3A3]">
                      {formatDateTime(checkIn.checkedInAt)}
                      <span className="ml-3 text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
                        {checkIn.method}
                      </span>
                    </p>
                    <button className={dangerButtonClass} type="button" onClick={() => handleDeleteCheckIn(checkIn)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {checkIns.length > TODAY_LIST_CAP ? (
            <p className="mt-4 text-sm text-[#A3A3A3]">
              Showing the latest {TODAY_LIST_CAP} of {checkIns.length} check-ins.
            </p>
          ) : null}
          <div className="mt-4">
            <button className={ghostButtonClass} type="button" onClick={() => setTab('history')}>
              View full history
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard
          title="Attendance history"
          description={`${history.length} check-in${history.length === 1 ? '' : 's'} in the selected range.`}
        >
          <StatusLine error={error} success={success} />

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-2 text-sm">
              <span>From</span>
              <input
                className={inputClass}
                type="date"
                value={historyFrom}
                onChange={(event) => setHistoryFrom(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>To</span>
              <input
                className={inputClass}
                type="date"
                value={historyTo}
                onChange={(event) => setHistoryTo(event.target.value)}
              />
            </label>
            <button className={primaryButtonClass} type="button" disabled={historyLoading} onClick={() => void loadHistory()}>
              {historyLoading ? 'Loading…' : 'Load'}
            </button>
            <button className={primaryButtonClass} type="button" disabled={history.length === 0} onClick={handleExportCsv}>
              Export CSV
            </button>
          </div>

          {historyLoading ? (
            <p className="text-sm text-[#A3A3A3]">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-[#A3A3A3]">No check-ins in this range.</p>
          ) : (
            <ul className="flex flex-col">
              {shownHistory.map((checkIn) => (
                <li
                  key={checkIn.id}
                  className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="text-base font-medium text-[#FAFAFA]">{checkIn.memberName}</p>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-[#A3A3A3]">
                      {formatDateTime(checkIn.checkedInAt)}
                      <span className="ml-3 text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
                        {checkIn.method}
                      </span>
                    </p>
                    <button className={dangerButtonClass} type="button" onClick={() => handleDeleteCheckIn(checkIn)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {history.length > HISTORY_CAP ? (
            <p className="mt-4 text-sm text-[#A3A3A3]">
              Showing the first {HISTORY_CAP} of {history.length} — narrow the range or export the full CSV.
            </p>
          ) : null}
        </SectionCard>
      )}

      {pendingDelete ? (
        <ConfirmModal
          title="Delete check-in"
          body={`Delete ${pendingDelete.memberName}'s check-in from ${formatDateTime(pendingDelete.checkedInAt)}? This cannot be undone.`}
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          danger
          pending={deletePending}
          error={deleteError}
          onConfirm={() => void handleConfirmDelete()}
          onCancel={() => {
            if (!deletePending) {
              setPendingDelete(null);
            }
          }}
        />
      ) : null}

      {scanning ? (
        <QrScanner
          onCode={(code) => {
            setScanning(false);
            void handleQrCheckIn(code);
          }}
          onError={(message) => {
            setScanning(false);
            setError(message);
          }}
          onClose={() => setScanning(false)}
        />
      ) : null}
    </PageShell>
  );
}