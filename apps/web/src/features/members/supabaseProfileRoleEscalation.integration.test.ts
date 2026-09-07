// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test proving the profile role escalation fix
// (migration 033). A non-owner cannot change any profile's role to
// 'owner'. Owners can still change roles. Legitimate self-updates
// (non-role fields) continue to work.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD (owner) and
// JYM_MEMBER_EMAIL/JYM_MEMBER_PASSWORD (member). Skipped when absent.

const hasTestUser = Boolean(
  process.env.JYM_TEST_EMAIL &&
    process.env.JYM_TEST_PASSWORD &&
    process.env.JYM_MEMBER_EMAIL &&
    process.env.JYM_MEMBER_PASSWORD
);
const describeLive = hasSupabaseConfig && hasTestUser ? describe : describe.skip;

async function signIn(email: string, password: string) {
  if (!supabase) return;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signIn as ${email} failed: ${error.message}`);
  }
}

describeLive('Profile role escalation prevention (live)', () => {
  const staffRepo = new SupabaseStaffRepository();
  const ownerEmail = process.env.JYM_TEST_EMAIL as string;
  const memberEmail = process.env.JYM_MEMBER_EMAIL as string;
  let testMemberProfileId: string | undefined;

  beforeAll(async () => {
    await signIn(ownerEmail, process.env.JYM_TEST_PASSWORD as string);
    const profiles = await staffRepo.listProfiles();
    const profile = profiles.find((candidate) => candidate.email === memberEmail);
    expect(profile).toBeTruthy();
    testMemberProfileId = profile?.id;
    await staffRepo.updateRole(profile?.id as string, 'staff');
  });

  afterAll(async () => {
    if (!supabase) return;
    await signIn(ownerEmail, process.env.JYM_TEST_PASSWORD as string);
    if (testMemberProfileId) {
      await staffRepo.updateRole(testMemberProfileId, 'member').catch(() => undefined);
    }
    await supabase.auth.signOut();
  });

  it('rejects a staff member changing their own role to owner', async () => {
    await signIn(memberEmail, process.env.JYM_MEMBER_PASSWORD as string);
    const profiles = await staffRepo.listProfiles();
    const memberProfile = profiles.find(
      (candidate) => candidate.email === memberEmail
    );
    expect(memberProfile?.role).toBe('staff');

    await expect(
      staffRepo.updateRole(memberProfile?.id as string, 'owner')
    ).rejects.toThrow(/Only the owner can change profile roles/);
  });

  it('rejects a member changing another user role to owner', async () => {
    await signIn(memberEmail, process.env.JYM_MEMBER_PASSWORD as string);
    const profiles = await staffRepo.listProfiles();
    const ownerProfile = profiles.find(
      (candidate) => candidate.email === ownerEmail
    );
    expect(ownerProfile).toBeTruthy();

    await expect(
      staffRepo.updateRole(ownerProfile?.id as string, 'owner')
    ).rejects.toThrow();
  });

  it('rejects a staff member changing another user role to owner', async () => {
    await signIn(memberEmail, process.env.JYM_MEMBER_PASSWORD as string);
    const profiles = await staffRepo.listProfiles();
    const ownerProfile = profiles.find(
      (candidate) => candidate.email === ownerEmail
    );
    expect(ownerProfile).toBeTruthy();

    await expect(
      staffRepo.updateRole(ownerProfile?.id as string, 'owner')
    ).rejects.toThrow();
  });

  it('allows owner to change another user role', async () => {
    await signIn(ownerEmail, process.env.JYM_TEST_PASSWORD as string);
    const profiles = await staffRepo.listProfiles();
    const memberProfile = profiles.find(
      (candidate) => candidate.email === memberEmail
    );
    expect(memberProfile).toBeTruthy();

    await staffRepo.updateRole(memberProfile?.id as string, 'staff');
    const afterPromote = await staffRepo.listProfiles();
    expect(
      afterPromote.find((candidate) => candidate.email === memberEmail)?.role
    ).toBe('staff');

    await staffRepo.updateRole(memberProfile?.id as string, 'member');
    const afterDemote = await staffRepo.listProfiles();
    expect(
      afterDemote.find((candidate) => candidate.email === memberEmail)?.role
    ).toBe('member');
  });

  it('allows member to update legitimate self-editable profile fields', async () => {
    await signIn(memberEmail, process.env.JYM_MEMBER_PASSWORD as string);
    const session = await supabase!.auth.getSession();
    const userId = session.data.session?.user.id;
    expect(userId).toBeTruthy();

    const newName = `IT Self Update ${Date.now()}`;
    const { error: updateError } = await supabase!
      .from('profiles')
      .update({ name: newName })
      .eq('id', userId as string);
    expect(updateError).toBeNull();

    const { data: after } = await supabase!
      .from('profiles')
      .select('name, role')
      .eq('id', userId as string)
      .maybeSingle();
    expect(after?.name).toBe(newName);
    expect(after?.role).toBe('member');

    await supabase!
      .from('profiles')
      .update({ name: after?.name })
      .eq('id', userId as string);
  });

  it('role remains unchanged after failed escalation attempt', async () => {
    await signIn(memberEmail, process.env.JYM_MEMBER_PASSWORD as string);
    const profiles = await staffRepo.listProfiles();
    const memberProfile = profiles.find(
      (candidate) => candidate.email === memberEmail
    );
    expect(memberProfile).toBeTruthy();
    const originalRole = memberProfile?.role;

    await expect(
      staffRepo.updateRole(memberProfile?.id as string, 'owner')
    ).rejects.toThrow();

    const after = await staffRepo.listProfiles();
    const currentRole = after.find(
      (candidate) => candidate.email === memberEmail
    )?.role;
    expect(currentRole).toBe(originalRole);
  });
});
