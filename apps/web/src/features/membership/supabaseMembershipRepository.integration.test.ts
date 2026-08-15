// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseMembershipRepository } from './supabaseMembershipRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (member/membership inserts are RLS-restricted).
// Skipped entirely when those env vars are absent (keeps `npm test` green in CI).

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

describeLive('SupabaseMembershipRepository (live)', () => {
  const repo = new SupabaseMembershipRepository();
  const memberRepo = new SupabaseMemberRepository();
  let createdMemberId: string | undefined;

  it('returns null when the signed-in user has no member profile', async () => {
    const membership = await repo.getMyMembership();
    expect(membership).toBeNull();
  });

  it('returns the active membership for the signed-in member', async () => {
    if (!supabase) {
      throw new Error('Supabase client unavailable');
    }

    const member = await memberRepo.createMember({
      fullName: `IT Member Profile ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    createdMemberId = member.id;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    expect(userId).toBeTruthy();

    const { data: planData, error: planError } = await supabase
      .from('membership_plans')
      .select('id')
      .limit(1)
      .single();
    expect(planError).toBeNull();
    expect(planData?.id).toBeTruthy();

    const { error: linkError } = await supabase
      .from('members')
      .update({ user_id: userId })
      .eq('id', member.id);
    expect(linkError).toBeNull();

    const { error: insertError } = await supabase.from('memberships').insert({
      member_id: member.id,
      plan_id: planData?.id,
      started_at: '2026-08-16',
      ended_at: '2026-09-15',
      status: 'active'
    });
    expect(insertError).toBeNull();

    const membership = await repo.getMyMembership();
    expect(membership?.memberName).toBe(member.fullName);
    expect(membership?.planName).toBeTruthy();
    expect(membership?.status).toBe('active');
    expect(membership?.endsAt).toBe('2026-09-15');
  });

  it('cleans up the linked member', async () => {
    if (!supabase) {
      throw new Error('Supabase client unavailable');
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    await supabase.from('members').update({ user_id: null }).eq('id', createdMemberId as string);
    expect(userId).toBeTruthy();
    await memberRepo.deleteMember(createdMemberId as string);
    const members = await memberRepo.listMembers();
    expect(members.some((member) => member.id === createdMemberId)).toBe(false);
  });
});