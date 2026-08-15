// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseBookingRepository } from './supabaseBookingRepository';
import { SupabaseClassRepository } from './supabaseClassRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (booking inserts/updates are RLS-restricted).
// Skipped entirely when those env vars are absent (keeps `npm test` green in CI).
// The env user is shared, so its data is never deleted.

const hasTestUser = Boolean(process.env.JYM_TEST_EMAIL && process.env.JYM_TEST_PASSWORD);
const describeLive = hasSupabaseConfig && hasTestUser ? describe : describe.skip;

beforeAll(async () => {
  if (!hasSupabaseConfig || !hasTestUser || !supabase) return;

  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (error) {
    throw new Error(`signIn with JYM_TEST_EMAIL failed: ${error.message}`);
  }
});

beforeEach(async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.getUser();
  if (!error) return;

  await supabase.auth.signOut();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (signInError) {
    throw new Error(`re-signIn with JYM_TEST_EMAIL failed: ${signInError.message}`);
  }
});

afterAll(async () => {
  if (!hasSupabaseConfig || !supabase) return;
  await supabase.auth.signOut();
});

describeLive('SupabaseBookingRepository (live)', () => {
  const bookingRepo = new SupabaseBookingRepository();
  const classRepo = new SupabaseClassRepository();
  const memberRepo = new SupabaseMemberRepository();
  let memberId: string | undefined;
  let memberName: string | undefined;
  let sessionId: string | undefined;
  let bookingId: string | undefined;

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it('creates a member, class, and session to book', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Booking Member ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    memberId = member.id;
    memberName = member.fullName;

    const gymClass = await classRepo.createClass({
      name: `IT Booking Class ${Date.now()}`,
      capacity: 5,
      dayOfWeek: 4,
      startTime: '17:00',
      endTime: '18:00'
    });
    const session = await classRepo.createSession(gymClass.id, tomorrow);
    sessionId = session.id;
    expect(member.id).toBeTruthy();
    expect(session.id).toBeTruthy();
  });

  it('books a member into the session', async () => {
    const booking = await bookingRepo.bookSession(sessionId as string, memberId as string);
    bookingId = booking.id;
    expect(booking.id).toBeTruthy();
    expect(booking.sessionId).toBe(sessionId);
    expect(booking.memberId).toBe(memberId);
    expect(booking.memberName).toBe(memberName);
    expect(booking.status).toBe('booked');
  });

  it('lists bookings including the created one', async () => {
    const bookings = await bookingRepo.listBookings();
    expect(bookings.some((booking) => booking.id === bookingId)).toBe(true);
  });

  it('cancels the booking', async () => {
    const booking = await bookingRepo.cancelBooking(bookingId as string);
    expect(booking.status).toBe('cancelled');
  });

  it('cleans up: deletes the class, cascading session and booking', async () => {
    const classes = await classRepo.listClasses();
    for (const gymClass of classes) {
      if (gymClass.name.startsWith('IT Booking Class')) {
        await classRepo.deleteClass(gymClass.id);
      }
    }
    await memberRepo.deleteMember(memberId as string);
    const bookings = await bookingRepo.listBookings();
    expect(bookings.some((booking) => booking.id === bookingId)).toBe(false);
  });
});