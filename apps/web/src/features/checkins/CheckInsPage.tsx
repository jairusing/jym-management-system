import { FormEvent, useCallback, useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
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

export function CheckInsPage() {
  const [tab, setTab] = useState<'checkin' | 'today' | 'history'>('checkin');
  const [members, setMembers] = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [historyFrom, setHistoryFrom] = useState(phDateInDays(-7));
  const [historyTo, setHistoryTo] = useState(phDateToday());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [qrCheckingIn, setQrCheckingIn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [deletingCheckInId, setDeletingCheckInId] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinSource, setPinSource] = useState<'manual' | 'qr'>('manual');
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSaving, setPinSaving] = useState(false);

  const load = async () => {
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
      setMembers(await mockMemberRepository.listMembers());
      setCheckIns(await mockCheckInRepository.listTodayCheckIns());
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
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFrom, historyTo]);

  useEffect(() => {
    void load();
    void loadHistory();
  }, [loadHistory]);

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
      setError('Enter a member ID.');
      return;
    }
    const member = members.find((candidate) => candidate.id === id);
    if (!member) {
      setError('No member matches that ID.');
      return;
    }
    await beginCheckIn(member, 'qr');
  };

  const beginCheckIn = async (member: Member, method: 'manual' | 'qr') => {
    if (!member.isActive) {
      setError('Cannot check in an inactive member.');
      return;
    }
    const expired = membershipExpiry(member);
    if (expired?.blocked) {
      setError(expired.message);
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
      setError(e instanceof Error ? e.message : 'Failed to check in member.');
    } finally {
      setCheckingInId(null);
      setQrCheckingIn(false);
    }
  };

  const completeCheckIn = async (member: Member, method: 'manual' | 'qr') => {
    const repo = hasSupabaseConfig ? new SupabaseCheckInRepository() : mockCheckInRepository;
    try {
      await repo.recordCheckIn({ memberId: member.id, memberName: member.fullName, method });
      setSuccess(method === 'qr' ? `${member.fullName} checked in via QR.` : `${member.fullName} checked in.`);
      if (method === 'qr') {
        setQrCode('');
      }
      await refreshTodayCheckIns();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check in member.');
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

  const handleDeleteCheckIn = async (checkIn: CheckIn) => {
    if (!window.confirm(`Delete ${checkIn.memberName}'s check-in from ${formatDateTime(checkIn.checkedInAt)}? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setSuccess(null);
    const repo = hasSupabaseConfig ? new SupabaseCheckInRepository() : mockCheckInRepository;
    setDeletingCheckInId(checkIn.id);
    try {
      await repo.deleteCheckIn(checkIn.id);
      await refreshTodayCheckIns();
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete check-in.');
    } finally {
      setDeletingCheckInId(null);
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

      {error ? <p className="mb-4 text-sm text-[#FF3D00]">{error}</p> : null}
      {success ? <p className="mb-4 text-sm text-[#FAFAFA]">{success}</p> : null}

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
          <div className="flex flex-col gap-4 pb-4">
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
              <button className={primaryButtonClass} type="button" disabled={qrCheckingIn} onClick={() => void handleQrCheckIn(qrCode)}>
                {qrCheckingIn ? 'Checking in…' : 'Check in via QR'}
              </button>
            </div>
          </div>

          {pinFor ? (
            <div className="mb-4 flex flex-col gap-4 border border-[#FFB300] bg-[#1A1A1A] p-4">
              <p className="text-sm font-medium text-[#FAFAFA]">
                Enter the PIN for {members.find((candidate) => candidate.id === pinFor)?.fullName ?? 'this member'}
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
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

          <form className="flex flex-col gap-4 border-t border-[#262626] pt-4" onSubmit={handleSearch}>
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
                    return (
                      <li
                        key={member.id}
                        className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-base font-medium text-[#FAFAFA]">
                            {member.fullName}
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
                        <button
                          className={primaryButtonClass}
                          type="button"
                          disabled={!member.isActive || expired?.blocked || checkingInId === member.id}
                          onClick={() => void handleCheckIn(member)}
                        >
                          {checkingInId === member.id ? 'Checking in…' : 'Check in'}
                        </button>
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
                  Showing the {RECENT_COUNT} most recent members — type to search.
                </p>
                <ul className="mt-2 flex flex-col">
                  {recentMembers.map((member) => {
                    const expired = membershipExpiry(member);
                    return (
                      <li
                        key={member.id}
                        className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-base font-medium text-[#FAFAFA]">
                            {member.fullName}
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
                        <button
                          className={primaryButtonClass}
                          type="button"
                          disabled={!member.isActive || expired?.blocked || checkingInId === member.id}
                          onClick={() => void handleCheckIn(member)}
                        >
                          {checkingInId === member.id ? 'Checking in…' : 'Check in'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </form>
        </SectionCard>
      ) : tab === 'today' ? (
        <SectionCard
          title="Today's check-ins"
          description={`${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'} today.`}
        >
          {loading ? (
            <p className="text-sm text-[#A3A3A3]">Loading…</p>
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
                    <button
                      className={dangerButtonClass}
                      type="button"
                      disabled={deletingCheckInId === checkIn.id}
                      onClick={() => void handleDeleteCheckIn(checkIn)}
                    >
                      {deletingCheckInId === checkIn.id ? 'Deleting…' : 'Delete'}
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
                    <button
                      className={dangerButtonClass}
                      type="button"
                      disabled={deletingCheckInId === checkIn.id}
                      onClick={() => void handleDeleteCheckIn(checkIn)}
                    >
                      {deletingCheckInId === checkIn.id ? 'Deleting…' : 'Delete'}
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