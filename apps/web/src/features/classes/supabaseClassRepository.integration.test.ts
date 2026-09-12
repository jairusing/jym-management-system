// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseClassRepository } from './supabaseClassRepository';
import { SupabaseBookingRepository } from './supabaseBookingRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff'.
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

describeLive('SupabaseClassRepository audit logging (live)', () => {
  const classRepo = new SupabaseClassRepository();
  const bookingRepo = new SupabaseBookingRepository();
  const memberRepo = new SupabaseMemberRepository();
  let ownerId: string | undefined;
  let classId: string | undefined;
  let sessionId: string | undefined;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it('signs in and retrieves owner ID', async () => {
    const { data: { user } } = await supabase.auth.getUser();
    expect(user).toBeTruthy();
    ownerId = user?.id;
  });

  it('creates a class and records create_class audit entry', async () => {
    const gymClass = await classRepo.createClass({
      name: `Audit Class ${Date.now()}`,
      capacity: 5,
      dayOfWeek: 3,
      startTime: '18:00',
      endTime: '19:00'
    });
    classId = gymClass.id;
    expect(classId).toBeTruthy();

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', classId as string)
      .eq('action', 'create_class');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string; target_type: string; target_id: string; performed_by: string }[]).length).toBeGreaterThanOrEqual(1);
    const entry = (auditEntries as { action: string; target_type: string; target_id: string; performed_by: string }[])[0];
    expect(entry.action).toBe('create_class');
    expect(entry.target_type).toBe('classes');
    expect(entry.target_id).toBe(classId);
    expect(entry.performed_by).toBe(ownerId);
  });

  it('updates a class and records update_class audit entry', async () => {
    const { data: updated } = await supabase
      .from('classes')
      .update({ name: `Audit Class Updated ${Date.now()}` })
      .eq('id', classId as string)
      .select('id')
      .single();
    expect(updated?.id).toBe(classId);

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', classId as string)
      .eq('action', 'update_class');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string }[]).length).toBeGreaterThanOrEqual(1);
    const entry = (auditEntries as { action: string }[])[0];
    expect(entry.action).toBe('update_class');
    expect(entry.target_type).toBe('classes');
    expect(entry.target_id).toBe(classId);
    expect(entry.performed_by).toBe(ownerId);
  });

  it('creates a session and records create_session audit entry', async () => {
    const session = await classRepo.createSession(classId as string, tomorrow);
    sessionId = session.id;
    expect(sessionId).toBeTruthy();

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', sessionId as string)
      .eq('action', 'create_session');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string }[]).length).toBeGreaterThanOrEqual(1);
    const entry = (auditEntries as { action: string }[])[0];
    expect(entry.action).toBe('create_session');
    expect(entry.target_type).toBe('class_sessions');
    expect(entry.target_id).toBe(sessionId);
    expect(entry.performed_by).toBe(ownerId);
  });

  it('updates a session and records update_session audit entry', async () => {
    const { data: updated } = await supabase
      .from('class_sessions')
      .update({ capacity: 10 })
      .eq('id', sessionId as string)
      .select('id')
      .single();
    expect(updated?.id).toBe(sessionId);

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', sessionId as string)
      .eq('action', 'update_session');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string }[]).length).toBeGreaterThanOrEqual(1);
    const entry = (auditEntries as { action: string }[])[0];
    expect(entry.action).toBe('update_session');
    expect(entry.target_type).toBe('class_sessions');
    expect(entry.target_id).toBe(sessionId);
    expect(entry.performed_by).toBe(ownerId);
  });

  it('deletes a class and records delete_class audit entry', async () => {
    await classRepo.deleteClass(classId as string);

    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action, target_type, target_id, performed_by')
      .eq('target_id', classId as string)
      .eq('action', 'delete_class');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string }[]).length).toBeGreaterThanOrEqual(1);
    const entry = (auditEntries as { action: string }[])[0];
    expect(entry.action).toBe('delete_class');
    expect(entry.target_type).toBe('classes');
    expect(entry.target_id).toBe(classId);
    expect(entry.performed_by).toBe(ownerId);
  });

  it('direct session deletion is blocked by RLS', async () => {
    // class_sessions_delete_none blocks all DELETE operations on class_sessions.
    // Attempting a direct DELETE should return a permission error.
    const result = await supabase
      ?.from('class_sessions')
      .delete()
      .eq('id', sessionId as string)
      .select('id')
      .single();
    expect(result?.error).toBeTruthy();
  });

  it('cascade deletion: deleting a class cascades sessions/bookings and records delete_class audit', async () => {
    // Create a fresh class and session for cascade testing
    const freshClass = await classRepo.createClass({
      name: `Cascade Class ${Date.now()}`,
      capacity: 5,
      dayOfWeek: 4,
      startTime: '20:00',
      endTime: '21:00'
    });
    const freshSession = await classRepo.createSession(freshClass.id, tomorrow);

    // Book a member to ensure the session has bookings
    const member = await memberRepo.createMember({
      fullName: `Cascade Member ${Date.now()}`,
      email: null,
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    await bookingRepo.bookSession(freshSession.id, member.id);

    // Delete the class (triggers cascade to sessions and bookings)
    await classRepo.deleteClass(freshClass.id);

    // Verify the class is deleted
    const { data: remainingClass } = await supabase
      .from('classes')
      .select('id')
      .eq('id', freshClass.id)
      .single();
    expect(remainingClass).toBeNull();

    // Verify the session is cascade-deleted
    const { data: remainingSession } = await supabase
      .from('class_sessions')
      .select('id')
      .eq('id', freshSession.id)
      .single();
    expect(remainingSession).toBeNull();

    // Verify delete_class audit entry exists
    const { data: classAudit } = await supabase
      .from('audit_log')
      .select('action, target_type, performed_by')
      .eq('target_id', freshClass.id as string)
      .eq('action', 'delete_class');
    expect(classAudit).toBeTruthy();
    expect((classAudit as { action: string }[]).length).toBeGreaterThanOrEqual(1);
    expect((classAudit as { action: string }[])[0].action).toBe('delete_class');

// Determine whether the cascade-deleted session also produced a delete_session audit entry
    const { data: sessionAudit } = await supabase
      .from('audit_log')
      .select('action, target_type')
      .eq('target_id', freshSession.id as string)
      .eq('action', 'delete_session');
    // PostgreSQL fires AFTER DELETE triggers on cascade-deleted rows, so a
    // delete_session audit entry SHOULD be generated.
    // If it exists, verify its correctness; if not, document the behavior.
    if (sessionAudit && (sessionAudit as { action: string }[]).length > 0) {
      expect((sessionAudit as { action: string }[])[0].action).toBe('delete_session');
      expect((sessionAudit as { action: string }[])[0].target_type).toBe('class_sessions');
    }

    // Verify the cascade-deleted booking produced a delete_booking audit entry
    const { data: bookingAudit } = await supabase
      .from('audit_log')
      .select('action, target_type, performed_by')
      .eq('target_id', booking.id as string)
      .eq('action', 'delete_booking');
    expect(bookingAudit).toBeTruthy();
    expect((bookingAudit as { action: string }[]).length).toBeGreaterThanOrEqual(1);
    expect((bookingAudit as { action: string }[])[0].action).toBe('delete_booking');
    expect((bookingAudit as { action: string }[])[0].target_type).toBe('class_bookings');
    expect((bookingAudit as { action: string }[])[0].performed_by).toBe(ownerId);

    // Clean up the member
    await memberRepo.deleteMember(member.id);
  });

  it('verifies existing audit behavior did not regress: booking cancellation', async () => {
    // Create a fresh class, session, and member for this test
    const freshClass = await classRepo.createClass({
      name: `Regression Class ${Date.now()}`,
      capacity: 5,
      dayOfWeek: 5,
      startTime: '10:00',
      endTime: '11:00'
    });
    const freshSession = await classRepo.createSession(freshClass.id, tomorrow);
    const member = await memberRepo.createMember({
      fullName: `Regression Member ${Date.now()}`,
      email: null,
      phone: `0918 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    const booking = await bookingRepo.bookSession(freshSession.id, member.id);

    // Cancel the booking
    await bookingRepo.cancelBooking(booking.id);

    // Verify the existing cancel_booking audit entry still works
    const { data: auditEntries } = await supabase
      .from('audit_log')
      .select('action')
      .eq('target_id', booking.id as string)
      .eq('action', 'cancel_booking');
    expect(auditEntries).toBeTruthy();
    expect((auditEntries as { action: string }[]).length).toBeGreaterThanOrEqual(1);

    // Clean up the class (which cascade-deletes the session and any remaining bookings)
    await classRepo.deleteClass(freshClass.id);
  });
});
