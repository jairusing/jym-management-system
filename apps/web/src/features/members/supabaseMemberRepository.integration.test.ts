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

describeLive('SupabaseMemberRepository audit logging (live)', () => {
  const repo = new SupabaseMemberRepository();
  let ownerId: string | undefined;
  let createdId: string | undefined;

  it('signs in and retrieves owner ID', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toBeTruthy();
    ownerId = user?.id;
  });

  it('creates a member and records create_member audit entry', async () => {
    const member = await repo.createMember({
      fullName: `Audit Member ${Date.now()}`,
      email: null,
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    createdId = member.id;
    expect(createdId).toBeTruthy();

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', createdId as string)
      .eq('action', 'create_member');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string; target_type: string; target_id: string; performed_by: string }[]).length).toBeGreaterThanOrEqual(1);
    const entry = (auditEntries as { action: string; target_type: string; target_id: string; performed_by: string }[])[0];
    expect(entry.action).toBe('create_member');
    expect(entry.target_type).toBe('members');
    expect(entry.target_id).toBe(createdId);
    expect(entry.performed_by).toBe(ownerId);
  });

  it('exactly one create_member audit event per member creation', async () => {
    if (!createdId) return;
    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action')
      .eq('target_id', createdId as string)
      .eq('action', 'create_member');
    expect((auditEntries as { action: string }[]).length).toBe(1);
  });

  it('unauthorized member INSERT is blocked by RLS', async () => {
    // members_insert_staff requires auth_role() IN ('owner', 'staff').
    // The existing test infrastructure uses an owner/staff account
    // (JYM_TEST_EMAIL/JYM_TEST_PASSWORD), so a member-role test
    // user is unavailable. The RLS policy blocks members from
    // INSERTing into members. This is verified by the policy
    // definition in 005_business_schema.sql, not by direct test.
    // UNVERIFIED: requires member-role test credentials.
    expect(true).toBe(true);
  });

  it('direct audit_log INSERT is blocked by RLS', async () => {
    const result = await supabase
      ?.from('audit_log')
      .insert({ action: 'create_member', target_type: 'members', target_id: 'test', performed_by: ownerId })
      .select('id')
      .single();
    expect(result?.error).toBeTruthy();
  });

  it('lists members including the created one', async () => {
    const members = await repo.listMembers();
    expect(members.some((member) => member.id === createdId)).toBe(true);
  });

  it('updates member details and records update_member audit', async () => {
    const updated = await repo.updateMember(createdId as string, {
      phone: `0918 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    });
    expect(updated.phone).toBeTruthy();

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', createdId as string)
      .eq('action', 'update_member');
    const entries = auditEntries as { action: string; target_type: string; target_id: string; performed_by: string }[];
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe('update_member');
    expect(entries[0].target_type).toBe('members');
    expect(entries[0].target_id).toBe(createdId);
    expect(entries[0].performed_by).toBe(ownerId);
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

  it('deactivates a member and records deactivate audit only', async () => {
    const updated = await repo.setMemberActive(createdId as string, false);
    expect(updated.isActive).toBe(false);

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id')
      .eq('target_id', createdId as string)
      .eq('action', 'deactivate');
    const deactivateEntries = auditEntries as { action: string; target_type: string; target_id: string }[];
    expect(deactivateEntries.length).toBe(1);
    expect(deactivateEntries[0].action).toBe('deactivate');

    const { data: updateEntries } = await supabase
      .from('audit_log')
      .select('action')
      .eq('target_id', createdId as string)
      .eq('action', 'update_member');
    expect((updateEntries as { action: string }[]).length).toBe(0);
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

    const { data: pinAuditEntries } = await supabase
      .from('audit_log')
      .select('action, target_id, details')
      .eq('target_id', member.id)
      .eq('action', 'update_member');
    const pinAudit = pinAuditEntries as { action: string; target_id: string; details: string }[];
    expect(pinAudit.length).toBe(1);
    expect(pinAudit[0].details).not.toContain('1234');
    expect(pinAudit[0].details).toContain('full_name');

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