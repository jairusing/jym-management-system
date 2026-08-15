// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseClassRepository } from './supabaseClassRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (class/session inserts are RLS-restricted).
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

describeLive('SupabaseClassRepository (live)', () => {
  const repo = new SupabaseClassRepository();
  let classId: string | undefined;
  let sessionId: string | undefined;

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const from = new Date(Date.now() - 86400000).toISOString();
  const to = new Date(Date.now() + 8 * 86400000).toISOString();

  it('creates a class', async () => {
    const gymClass = await repo.createClass({
      name: `IT Class ${Date.now()}`,
      capacity: 8,
      dayOfWeek: 3,
      startTime: '18:00',
      endTime: '19:00'
    });
    classId = gymClass.id;
    expect(gymClass.id).toBeTruthy();
    expect(gymClass.capacity).toBe(8);
    expect(gymClass.dayOfWeek).toBe(3);
  });

  it('creates a session copying the class capacity and time', async () => {
    const session = await repo.createSession(classId as string, tomorrow);
    sessionId = session.id;
    expect(session.id).toBeTruthy();
    expect(session.className).toContain('IT Class');
    expect(session.capacity).toBe(8);
    expect(session.status).toBe('scheduled');
  });

  it('lists sessions in the window including the created one', async () => {
    const sessions = await repo.listSessions(from, to);
    expect(sessions.some((session) => session.id === sessionId)).toBe(true);
  });

  it('deletes the class, cascading its sessions', async () => {
    await repo.deleteClass(classId as string);
    const sessions = await repo.listSessions(from, to);
    expect(sessions.some((session) => session.id === sessionId)).toBe(false);
  });
});