// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseStaffRepository } from './supabaseStaffRepository';

declare const process: { env: Record<string, string | undefined> };

// Live test proving staff-account management against the real project:
// the owner can list all profiles and change roles (profiles_select_staff +
// profiles_update_role_owner RLS). Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD
// (owner role). The member test account's role is changed and reverted.

const hasTestUser = Boolean(process.env.JYM_TEST_EMAIL && process.env.JYM_TEST_PASSWORD);
const describeLive = hasSupabaseConfig && hasTestUser ? describe : describe.skip;

async function signIn() {
  if (!supabase) return;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (error) {
    throw new Error(`signIn failed: ${error.message}`);
  }
}

beforeAll(signIn);

beforeEach(async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.getUser();
  if (!error) return;
  await signIn();
});

afterAll(async () => {
  if (!hasSupabaseConfig || !supabase) return;
  await supabase.auth.signOut();
});

describeLive('Staff management (live)', () => {
  const repo = new SupabaseStaffRepository();

  it('reports the signed-in owner role', async () => {
    expect(await repo.getMyRole()).toBe('owner');
  });

  it('lists all profiles including the owner and the member test account', async () => {
    const profiles = await repo.listProfiles();
    expect(profiles.some((profile) => profile.email === 'jairusingente3@gmail.com')).toBe(true);
    expect(profiles.some((profile) => profile.email === 'jms.test@demo.jms')).toBe(true);
    expect(profiles.some((profile) => profile.email === 'jms.member@demo.jms')).toBe(true);
  });

  it('changes a member-role account to staff and back', async () => {
    const profiles = await repo.listProfiles();
    const memberProfile = profiles.find((profile) => profile.email === 'jms.member@demo.jms');
    expect(memberProfile).toBeTruthy();

    await repo.updateRole(memberProfile?.id as string, 'staff');
    const afterPromote = await repo.listProfiles();
    expect(
      afterPromote.find((profile) => profile.email === 'jms.member@demo.jms')?.role
    ).toBe('staff');

    await repo.updateRole(memberProfile?.id as string, 'member');
    const afterRevert = await repo.listProfiles();
    expect(
      afterRevert.find((profile) => profile.email === 'jms.member@demo.jms')?.role
    ).toBe('member');
  });
});