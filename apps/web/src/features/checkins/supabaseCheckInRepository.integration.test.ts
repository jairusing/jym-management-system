// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseCheckInRepository } from './supabaseCheckInRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (check-in inserts are RLS-restricted).
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

describeLive('SupabaseCheckInRepository (live)', () => {
  const checkInRepo = new SupabaseCheckInRepository();
  const memberRepo = new SupabaseMemberRepository();
  let memberId: string | undefined;
  let memberName: string | undefined;

  it('creates a member to check in', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Check-in Member ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    memberId = member.id;
    memberName = member.fullName;
    expect(member.id).toBeTruthy();
  });

  it('records a manual check-in', async () => {
    const checkIn = await checkInRepo.recordCheckIn({
      memberId: memberId as string,
      memberName: memberName as string
    });
    expect(checkIn.id).toBeTruthy();
    expect(checkIn.memberId).toBe(memberId);
    expect(checkIn.memberName).toBe(memberName);
    expect(checkIn.method).toBe('manual');
    expect(checkIn.processedBy).toBeTruthy();
  });

  it('lists today check-ins including the recorded one', async () => {
    const checkIns = await checkInRepo.listTodayCheckIns();
    expect(checkIns.some((checkIn) => checkIn.memberId === memberId)).toBe(true);
  });

  it('lists check-ins within an explicit date range', async () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    const checkIns = await checkInRepo.listCheckIns(from, to);
    expect(checkIns.some((checkIn) => checkIn.memberId === memberId)).toBe(true);
    const outside = await checkInRepo.listCheckIns('2000-01-01T00:00:00.000Z', '2000-01-02T00:00:00.000Z');
    expect(outside.some((checkIn) => checkIn.memberId === memberId)).toBe(false);
  });

  it('deletes the member, cascading its check-ins', async () => {
    await memberRepo.deleteMember(memberId as string);
    const checkIns = await checkInRepo.listTodayCheckIns();
    expect(checkIns.some((checkIn) => checkIn.memberId === memberId)).toBe(false);
  });
});