import { FormEvent, useEffect, useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { hasSupabaseConfig } from '../../lib/supabase';
import { dayOfWeekLabels, mockClassRepository, type ClassItem, type ClassSession } from './classRepository';
import { SupabaseClassRepository } from './supabaseClassRepository';
import { mockBookingRepository, type Booking } from './bookingRepository';
import { SupabaseBookingRepository } from './supabaseBookingRepository';
import { mockMemberRepository, type Member } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

const inputClass =
  'border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]';

const buttonClass =
  'inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:opacity-50';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date) {
  const day = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function weekdayOf(date: Date) {
  return (date.getDay() + 6) % 7;
}

function formatWeekLabel(start: Date) {
  const end = addDays(start, 6);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${new Intl.DateTimeFormat('en-US', options).format(start)} – ${new Intl.DateTimeFormat('en-US', {
    ...options,
    year: 'numeric'
  }).format(end)}`;
}

function formatSessionDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatTime(date: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}

function sortByDay(a: ClassSession, b: ClassSession) {
  return weekdayOf(new Date(a.scheduledAt)) - weekdayOf(new Date(b.scheduledAt));
}

export function ClassSchedulePage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const [name, setName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [capacity, setCapacity] = useState(10);
  const [saving, setSaving] = useState(false);

  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [bookMemberId, setBookMemberId] = useState('');

  const load = async (targetWeek: Date) => {
    if (!hasSupabaseConfig) {
      setClasses(await mockClassRepository.listClasses());
      setSessions(await mockClassRepository.listSessions(targetWeek.toISOString(), addDays(targetWeek, 7).toISOString()));
      setBookings(await mockBookingRepository.listBookings());
      setMembers(await mockMemberRepository.listMembers());
      setLoading(false);
      return;
    }
    const classRepo = new SupabaseClassRepository();
    const bookingRepo = new SupabaseBookingRepository();
    const memberRepo = new SupabaseMemberRepository();
    try {
      const [loadedClasses, loadedSessions, loadedBookings, loadedMembers] = await Promise.all([
        classRepo.listClasses(),
        classRepo.listSessions(targetWeek.toISOString(), addDays(targetWeek, 7).toISOString()),
        bookingRepo.listBookings(),
        memberRepo.listMembers()
      ]);
      setClasses(loadedClasses);
      setSessions(loadedSessions);
      setBookings(loadedBookings);
      setMembers(loadedMembers);
    } catch (e) {
      console.warn('Failed to load schedule from Supabase', e);
      setClasses(await mockClassRepository.listClasses());
      setSessions(await mockClassRepository.listSessions(targetWeek.toISOString(), addDays(targetWeek, 7).toISOString()));
      setBookings(await mockBookingRepository.listBookings());
      setMembers(await mockMemberRepository.listMembers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(startOfWeek(new Date()));
  }, []);

  const handleCreateClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const repo = hasSupabaseConfig ? new SupabaseClassRepository() : mockClassRepository;
    setSaving(true);
    try {
      await repo.createClass({ name, capacity, dayOfWeek, startTime, endTime });
      setName('');
      setCapacity(10);
      setStartTime('09:00');
      setEndTime('10:00');
      await load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add class.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async (gymClass: ClassItem) => {
    const repo = hasSupabaseConfig ? new SupabaseClassRepository() : mockClassRepository;
    setError(null);
    setSuccess(null);
    try {
      await repo.deleteClass(gymClass.id);
      await load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete class.');
    }
  };

  const handleGenerateWeek = async (gymClass: ClassItem) => {
    const repo = hasSupabaseConfig ? new SupabaseClassRepository() : mockClassRepository;
    setError(null);
    setSuccess(null);
    try {
      await repo.createSession(gymClass.id, toDateInput(addDays(weekStart, gymClass.dayOfWeek)));
      await load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule session.');
    }
  };

  const handleBook = async (sessionId: string) => {
    if (!bookMemberId) {
      setError('Select a member to book.');
      return;
    }
    const repo = hasSupabaseConfig ? new SupabaseBookingRepository() : mockBookingRepository;
    setError(null);
    setSuccess(null);
    const member = members.find((candidate) => candidate.id === bookMemberId);
    try {
      await repo.bookSession(sessionId, bookMemberId, member?.fullName);
      setBookMemberId('');
      setBookingFor(null);
      await load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to book session.');
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    const repo = hasSupabaseConfig ? new SupabaseBookingRepository() : mockBookingRepository;
    setError(null);
    setSuccess(null);
    try {
      await repo.cancelBooking(booking.id);
      await load(weekStart);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel booking.');
    }
  };

  const changeWeek = (direction: number) => {
    const next = addDays(weekStart, direction * 7);
    setWeekStart(next);
    void load(next);
  };

  const sortedSessions = [...sessions].sort(sortByDay);
  const hasSessionOnDay = (gymClass: ClassItem) =>
    sessions.some(
      (session) =>
        session.classId === gymClass.id && weekdayOf(new Date(session.scheduledAt)) === gymClass.dayOfWeek
    );

  return (
    <PageShell
      eyebrow="Management"
      title="Class schedule"
      description="Define recurring classes, materialize sessions, and manage bookings."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}
      {success ? <p className="text-sm text-[#FAFAFA]">{success}</p> : null}

      <SectionCard title="Add class" description="A class repeats weekly on one day of the week.">
        <form className="flex flex-col gap-4" onSubmit={handleCreateClass}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              <span>Name</span>
              <input
                className={inputClass}
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Day of week</span>
              <select
                className={inputClass}
                value={dayOfWeek}
                onChange={(event) => setDayOfWeek(Number(event.target.value))}
              >
                {dayOfWeekLabels.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Start time</span>
              <input
                className={inputClass}
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>End time</span>
              <input
                className={inputClass}
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Capacity</span>
              <input
                className={inputClass}
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                required
              />
            </label>
          </div>

          <div>
            <button className={buttonClass} type="submit" disabled={saving}>
              {saving ? 'Adding…' : 'Add class'}
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Classes" description={`${classes.length} recurring class${classes.length === 1 ? '' : 'es'}.`}>
        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-[#737373]">No classes yet. Add your first class above.</p>
        ) : (
          <ul className="flex flex-col">
            {classes.map((gymClass) => {
              const scheduled = hasSessionOnDay(gymClass);
              return (
                <li
                  key={gymClass.id}
                  className="flex flex-col gap-4 border-b border-[#262626] py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-base font-medium text-[#FAFAFA]">{gymClass.name}</p>
                    <p className="mt-1 text-sm text-[#737373]">
                      {dayOfWeekLabels[gymClass.dayOfWeek]} · {gymClass.startTime.slice(0, 5)}–
                      {gymClass.endTime.slice(0, 5)} · capacity {gymClass.capacity}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={buttonClass}
                      type="button"
                      disabled={scheduled}
                      onClick={() => void handleGenerateWeek(gymClass)}
                    >
                      {scheduled ? 'Scheduled this week' : 'Schedule this week'}
                    </button>
                    <button
                      className={`${buttonClass} border-[#262626] text-[#737373] hover:text-[#FF3D00]`}
                      type="button"
                      onClick={() => void handleDeleteClass(gymClass)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Schedule"
        description={`${formatWeekLabel(weekStart)} — click a session to book members.`}
      >
        <div className="mb-6 flex items-center justify-between">
          <button className={buttonClass} type="button" onClick={() => changeWeek(-1)}>
            Previous week
          </button>
          <button className={buttonClass} type="button" onClick={() => changeWeek(1)}>
            Next week
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[#737373]">Loading…</p>
        ) : sortedSessions.length === 0 ? (
          <p className="text-sm text-[#737373]">
            No sessions this week. Use “Schedule this week” on a class above.
          </p>
        ) : (
          <ul className="flex flex-col">
            {sortedSessions.map((session) => {
              const sessionBookings = bookings.filter((booking) => booking.sessionId === session.id);
              const bookedCount = sessionBookings.filter((booking) => booking.status !== 'cancelled').length;
              const isFull = bookedCount >= session.capacity;
              return (
                <li key={session.id} className="border-b border-[#262626] py-5 last:border-b-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-base font-medium text-[#FAFAFA]">{session.className}</p>
                      <p className="mt-1 text-sm text-[#737373]">
                        {formatSessionDate(new Date(session.scheduledAt))} · {formatTime(session.scheduledAt)}–
                        {session.endTime.slice(0, 5)} · {bookedCount}/{session.capacity} booked
                      </p>
                    </div>
                    <button
                      className={`${buttonClass} disabled:opacity-50`}
                      type="button"
                      disabled={isFull}
                      onClick={() => {
                        setBookingFor(bookingFor === session.id ? null : session.id);
                        setBookMemberId('');
                      }}
                    >
                      {isFull ? 'Full' : bookingFor === session.id ? 'Close' : 'Book a member'}
                    </button>
                  </div>

                  {bookingFor === session.id ? (
                    <div className="mt-4 flex flex-col gap-3 border border-[#262626] bg-[#1A1A1A] p-4 sm:flex-row sm:items-end">
                      <label className="flex flex-col gap-2 text-sm sm:flex-1">
                        <span>Member</span>
                        <select
                          className={inputClass}
                          value={bookMemberId}
                          onChange={(event) => setBookMemberId(event.target.value)}
                        >
                          <option value="">Select a member…</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.fullName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button className={buttonClass} type="button" onClick={() => void handleBook(session.id)}>
                        Book
                      </button>
                    </div>
                  ) : null}

                  {sessionBookings.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-2">
                      {sessionBookings.map((booking) => (
                        <li
                          key={booking.id}
                          className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <p className="text-[#FAFAFA]">
                            {booking.memberName}
                            <span
                              className={`ml-3 text-[0.7rem] uppercase tracking-[0.2em] ${
                                booking.status === 'cancelled' ? 'text-[#FF3D00]' : 'text-[#737373]'
                              }`}
                            >
                              {booking.status}
                            </span>
                          </p>
                          {booking.status === 'booked' ? (
                            <button
                              className={`${buttonClass} border-[#262626] px-3 py-2 text-[#737373] hover:text-[#FF3D00]`}
                              type="button"
                              onClick={() => void handleCancelBooking(booking)}
                            >
                              Cancel
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </PageShell>
  );
}
