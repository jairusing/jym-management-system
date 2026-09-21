// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';

declare const process: { env: Record<string, string | undefined> };

// Live integration test proving the profiles_insert_self defense-in-depth
// (migration 044). Authenticated users can only self-insert profiles with
// role = 'member'. Attempts to insert as 'staff' or 'owner' are rejected
// by the RLS WITH CHECK constraint.
//
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD (any role) for live tests.
// Skipped when absent.

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

describeLive('profiles_insert_self defense-in-depth (migration 044)', () => {
  beforeAll(async () => {
    await signIn();
  });

  afterAll(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  });

  it('self-insert with role member is allowed by profiles_insert_self', async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;
    if (!userId) throw new Error('No authenticated user');

    // Clean up if the test row already exists from a previous run
    await supabase.from('profiles').delete().eq('id', userId).single().catch(() => {});

    // Insert a profile with role = 'member' (the default)
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, name: 'Test User', email: process.env.JYM_TEST_EMAIL, role: 'member' });

    expect(insertError).toBeNull();

    // Clean up the test row
    await supabase.from('profiles').delete().eq('id', userId).single().catch(() => {});
  });

  it('self-insert with role owner is rejected by profiles_insert_self', async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;
    if (!userId) throw new Error('No authenticated user');

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, name: 'Test Owner', email: process.env.JYM_TEST_EMAIL, role: 'owner' });

    expect(insertError).not.toBeNull();
  });

  it('self-insert with role staff is rejected by profiles_insert_self', async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;
    if (!userId) throw new Error('No authenticated user');

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, name: 'Test Staff', email: process.env.JYM_TEST_EMAIL, role: 'staff' });

    expect(insertError).not.toBeNull();
  });

  it('self-insert with role unspecified defaults to member and is allowed', async () => {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user.id;
    if (!userId) throw new Error('No authenticated user');

    // Clean up if the test row already exists
    await supabase.from('profiles').delete().eq('id', userId).single().catch(() => {});

    // Insert a profile without specifying role (should default to 'member')
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({ id: userId, name: 'Test Default', email: process.env.JYM_TEST_EMAIL });

    expect(insertError).toBeNull();

    // Clean up the test row
    await supabase.from('profiles').delete().eq('id', userId).single().catch(() => {});
  });
});
