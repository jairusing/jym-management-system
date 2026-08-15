// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseMemberRepository } from './supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (members inserts are RLS-restricted).
//   UPDATE public.profiles SET role = 'owner' WHERE email = '<your email>';
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

describeLive('SupabaseMemberRepository (live)', () => {
  const repo = new SupabaseMemberRepository();
  let createdId: string | undefined;

  it('creates a member', async () => {
    const member = await repo.createMember({
      fullName: `IT Walk-in ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    createdId = member.id;
    expect(member.id).toBeTruthy();
    expect(member.isActive).toBe(true);
    expect(member.membership).toBeNull();
  });

  it('lists members including the created one', async () => {
    const members = await repo.listMembers();
    expect(members.some((member) => member.id === createdId)).toBe(true);
  });

  it('updates member details', async () => {
    const updated = await repo.updateMember(createdId as string, { phone: '0918 111 2222' });
    expect(updated.phone).toBe('0918 111 2222');
  });

  it('deactivates a member', async () => {
    const updated = await repo.setMemberActive(createdId as string, false);
    expect(updated.isActive).toBe(false);
  });

  it('deletes the member', async () => {
    await repo.deleteMember(createdId as string);
    const members = await repo.listMembers();
    expect(members.some((member) => member.id === createdId)).toBe(false);
  });
});