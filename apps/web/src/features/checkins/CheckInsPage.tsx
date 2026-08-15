import { FormEvent, useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { hasSupabaseConfig } from '../../lib/supabase';
import { mockCheckInRepository, type CheckIn } from './checkInRepository';
import { SupabaseCheckInRepository } from './supabaseCheckInRepository';
import { mockMemberRepository, type Member } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

const inputClass =
  'border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]';

const buttonClass =
  'inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:opacity-50';

function formatTime(date: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

export function CheckInsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [checkingInId, setCheckingInId] = useState<string | null>(null);

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

  useEffect(() => {
    void load();
  }, []);

  const handleCheckIn = async (member: Member) => {
    if (!member.isActive) {
      setError('Cannot check in an inactive member.');
      return;
    }
    setError(null);
    setSuccess(null);

    const repo = hasSupabaseConfig ? new SupabaseCheckInRepository() : mockCheckInRepository;
    setCheckingInId(member.id);
    try {
      await repo.recordCheckIn({ memberId: member.id, memberName: member.fullName });
      setSuccess(`${member.fullName} checked in.`);
      setCheckIns(hasSupabaseConfig
        ? await new SupabaseCheckInRepository().listTodayCheckIns()
        : await mockCheckInRepository.listTodayCheckIns());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check in member.');
    } finally {
      setCheckingInId(null);
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  const filteredMembers = members.filter((member) =>
    member.fullName.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <PageShell
      eyebrow="Management"
      title="Check-ins"
      description="Search a member and record their visit."
    >
      <BackLink to="/app" label="Back to dashboard" />

      <SectionCard title="Check in a member" description="Find the member by name, then tap check in.">
        {error ? <p className="mb-4 text-sm text-[#FF3D00]">{error}</p> : null}
        {success ? <p className="mb-4 text-sm text-[#FAFAFA]">{success}</p> : null}

        <form className="flex flex-col gap-4" onSubmit={handleSearch}>
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
            <p className="text-sm text-[#737373]">Loading…</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-[#737373]">
              {query.trim() ? 'No members match that name.' : 'No members yet. Add members first.'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filteredMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-col gap-4 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-medium text-[#FAFAFA]">
                      {member.fullName}
                      {member.isActive ? null : (
                        <span className="ml-3 text-[0.7rem] uppercase tracking-[0.2em] text-[#FF3D00]">
                          Inactive
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-[#737373]">
                      {member.phone ? member.phone : member.email ? member.email : 'No contact on file'}
                    </p>
                  </div>
                  <button
                    className={`${buttonClass} ${member.isActive ? '' : 'border-[#262626] text-[#737373]'}`}
                    type="button"
                    disabled={!member.isActive || checkingInId === member.id}
                    onClick={() => void handleCheckIn(member)}
                  >
                    {checkingInId === member.id ? 'Checking in…' : 'Check in'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </form>
      </SectionCard>

      <SectionCard
        title="Today's check-ins"
        description={`${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'} today.`}
      >
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : checkIns.length === 0 ? (
          <p className="text-sm text-[#737373]">No check-ins yet today.</p>
        ) : (
          <ul className="flex flex-col">
            {checkIns.map((checkIn) => (
              <li
                key={checkIn.id}
                className="flex flex-col gap-1 border-b border-[#262626] py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-base font-medium text-[#FAFAFA]">{checkIn.memberName}</p>
                <p className="text-sm text-[#737373]">
                  {formatTime(checkIn.checkedInAt)}
                  <span className="ml-3 text-[0.7rem] uppercase tracking-[0.2em] text-[#737373]">
                    {checkIn.method}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageShell>
  );
}