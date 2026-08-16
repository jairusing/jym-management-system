// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseMemberRepository } from './supabaseMemberRepository';
import { SupabaseInvoiceRepository } from '../payments/supabaseInvoiceRepository';

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
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    const updated = await repo.updateMember(createdId as string, {
      phone: `0918 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    });
    expect(updated.phone).toBeTruthy();
  });

  it('rejects a duplicate email', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const first = await repo.createMember({
      fullName: `IT Dup Email 1 ${stamp}`,
      email: `it-dup-${stamp}@demo.jms`,
      phone: `0917 ${stamp}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    await expect(
      repo.createMember({
        fullName: `IT Dup Email 2 ${stamp}`,
        email: `it-dup-${stamp}@demo.jms`,
        phone: `0918 ${stamp}`,
        joinedAt: '2026-08-16',
        notes: 'integration test'
      })
    ).rejects.toThrow('A member with this email already exists.');
    await repo.deleteMember(first.id);
  });

  it('rejects a duplicate phone', async () => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const first = await repo.createMember({
      fullName: `IT Dup Phone 1 ${stamp}`,
      email: null,
      phone: `0917 ${stamp}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    await expect(
      repo.createMember({
        fullName: `IT Dup Phone 2 ${stamp}`,
        email: null,
        phone: `0917 ${stamp}`,
        joinedAt: '2026-08-16',
        notes: 'integration test'
      })
    ).rejects.toThrow('A member with this phone number already exists.');
    await repo.deleteMember(first.id);
  });

  it('deactivates a member', async () => {
    const updated = await repo.setMemberActive(createdId as string, false);
    expect(updated.isActive).toBe(false);
  });

  it('pauses, resumes, and cancels a membership', async () => {
    const member = await repo.createMember({
      fullName: `IT Pause Member ${Date.now()}`,
      email: null,
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    const plans = await new SupabaseInvoiceRepository().listPlans();
    const planId = plans[0]?.id as string;

    const { error: insertError } = await supabase!.from('memberships').insert({
      member_id: member.id,
      plan_id: planId,
      started_at: '2026-08-16',
      ended_at: '2026-09-15',
      status: 'active'
    });
    if (insertError) {
      throw new Error(`membership insert failed: ${insertError.message}`);
    }

    const paused = await repo.setMembershipStatus(member.id, 'paused');
    expect(paused.membership?.status).toBe('paused');
    expect(paused.membership?.planName).toBeTruthy();

    const resumed = await repo.setMembershipStatus(member.id, 'active');
    expect(resumed.membership?.status).toBe('active');

    const cancelled = await repo.setMembershipStatus(member.id, 'cancelled');
    expect(cancelled.membership?.status).toBe('cancelled');

    await expect(repo.setMembershipStatus(member.id, 'paused')).rejects.toThrow(
      'No active membership to update.'
    );
    await repo.deleteMember(member.id);
  });

  it('sets, verifies, and clears a member PIN (hashed server-side)', async () => {
    const member = await repo.createMember({
      fullName: `IT Pin Member ${Date.now()}`,
      email: null,
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });

    expect(await repo.verifyMemberPin(member.id, '1234')).toBe('missing');

    await repo.setMemberPin(member.id, '1234');
    expect(await repo.verifyMemberPin(member.id, '1234')).toBe('ok');
    expect(await repo.verifyMemberPin(member.id, '9999')).toBe('fail');

    const { data: stored, error: storedError } = await supabase!
      .from('members')
      .select('pin')
      .eq('id', member.id)
      .single();
    if (storedError) {
      throw new Error(`pin select failed: ${storedError.message}`);
    }
    expect(stored.pin).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(stored.pin).not.toBe('1234');

    await repo.setMemberPin(member.id, null);
    expect(await repo.verifyMemberPin(member.id, '1234')).toBe('missing');

    await repo.deleteMember(member.id);
  });

  it('deletes the member', async () => {
    await repo.deleteMember(createdId as string);
    const members = await repo.listMembers();
    expect(members.some((member) => member.id === createdId)).toBe(false);
  });
});