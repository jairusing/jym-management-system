// @vitest-environment node
import { type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createLoginWithClients, type CreateLoginInput } from './create-login';

type FakeOptions = {
  tokenUser?: { id: string } | null;
  role?: string | null;
  member?: { id: string; user_id: string | null; full_name: string } | null;
  memberError?: { message: string } | null;
  createError?: { message: string } | null;
  linkError?: { message: string } | null;
  getUserError?: { message: string } | null;
};

function buildFakes(options: FakeOptions) {
  const getUser = vi.fn(async () => {
    if (options.getUserError) {
      return { data: null, error: options.getUserError };
    }
    return { data: { user: options.tokenUser ?? null }, error: null };
  });

  const profileSingle = vi.fn(async () =>
    options.role
      ? { data: { role: options.role }, error: null }
      : { data: null, error: { message: 'profile not found' } }
  );
  const profileEq = vi.fn(() => ({ single: profileSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));

  const memberMaybeSingle = vi.fn(async () =>
    options.member
      ? { data: options.member, error: null }
      : { data: null, error: options.memberError ?? { message: 'member not found' } }
  );
  const memberEq = vi.fn(() => ({ maybeSingle: memberMaybeSingle }));
  const memberSelect = vi.fn(() => ({ eq: memberEq }));

  const createUser = vi.fn(async () =>
    options.createError
      ? { data: null, error: options.createError }
      : { data: { user: { id: 'created-user-1', email: 'new@example.com' } }, error: null }
  );

  const deleteUser = vi.fn(async () => ({ data: null, error: null }));

  const linkSingle = vi.fn(async () =>
    options.linkError
      ? { data: null, error: options.linkError }
      : { data: { user_id: 'created-user-1' }, error: null }
  );
  const linkSelect = vi.fn(() => ({ single: linkSingle }));
  const linkState = { lastEqCall: undefined as [string, string] | undefined };
  const eqChain = vi.fn((column: string, value: string) => {
    linkState.lastEqCall = [column, value];
    return { select: linkSelect };
  });
  type LinkPayload = { user_id: string };
  const linkUpdate = vi.fn<(payload: LinkPayload) => { eq: typeof eqChain }>(() => ({ eq: eqChain }));

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return { select: profileSelect };
    }
    if (table === 'members') {
      return { select: memberSelect, update: linkUpdate };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  const auth = {
    getUser,
    admin: { createUser, deleteUser }
  };

  const client = { auth, from } as unknown as SupabaseClient;
  return { client, getUser, profileEq, memberEq, createUser, linkUpdate, deleteUser, linkState };
}

const baseInput: CreateLoginInput = {
  memberId: 'member-1',
  email: 'Juan@Example.com',
  password: 'secret123'
};

describe('createLoginWithClients', () => {
  it('rejects a missing member id', async () => {
    const { client } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await createLoginWithClients(client, client, 'token', { ...baseInput, memberId: ' ' });
    expect(outcome.status).toBe(400);
    expect(outcome.body.error).toMatch(/member is required/i);
  });

  it('rejects an invalid email', async () => {
    const { client } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await createLoginWithClients(client, client, 'token', { ...baseInput, email: 'not-an-email' });
    expect(outcome.status).toBe(400);
    expect(outcome.body.error).toMatch(/valid email/i);
  });

  it('rejects a short password', async () => {
    const { client } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await createLoginWithClients(client, client, 'token', { ...baseInput, password: 'abc' });
    expect(outcome.status).toBe(400);
    expect(outcome.body.error).toMatch(/at least 6/i);
  });

  it('rejects a missing token without calling getUser', async () => {
    const { client, getUser } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await createLoginWithClients(client, client, null, baseInput);
    expect(outcome.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const { client } = buildFakes({ getUserError: { message: 'invalid JWT' } });
    const outcome = await createLoginWithClients(client, client, 'bad-token', baseInput);
    expect(outcome.status).toBe(401);
  });

  it('rejects a caller who is not owner or staff', async () => {
    const { client, createUser } = buildFakes({ tokenUser: { id: 'member-9' }, role: 'member' });
    const outcome = await createLoginWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(403);
    expect(outcome.body.error).toMatch(/only owner or staff/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects when the member does not exist', async () => {
    const { client, createUser } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff', member: null });
    const outcome = await createLoginWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(404);
    expect(outcome.body.error).toMatch(/member not found/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects when the member already has a login', async () => {
    const { client, createUser } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: 'user-1', full_name: 'Juan Dela Cruz' }
    });
    const outcome = await createLoginWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(409);
    expect(outcome.body.error).toMatch(/already has a login/i);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('rejects when the email is already registered', async () => {
    const { client, createUser, linkUpdate } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      createError: { message: 'A user with this email address has already been registered' }
    });
    const outcome = await createLoginWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(409);
    expect(outcome.body.error).toMatch(/already exists/i);
    expect(createUser).toHaveBeenCalled();
    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it('creates the user, links the member, and returns ok', async () => {
    const { client, createUser, linkUpdate, linkState } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' }
    });
    const outcome = await createLoginWithClients(client, client, 'token', baseInput);

    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({ ok: true, email: 'juan@example.com' });

    expect(createUser).toHaveBeenCalledWith({
      email: 'juan@example.com',
      password: 'secret123',
      email_confirm: true,
      user_metadata: { full_name: 'Juan Dela Cruz' }
    });

    expect(linkUpdate).toHaveBeenCalledWith({ user_id: 'created-user-1' });
    expect(linkState.lastEqCall).toEqual(['id', 'member-1']);
  });

  it('deletes the created user when linking fails', async () => {
    const { client, deleteUser } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      linkError: { message: 'update failed' }
    });
    const outcome = await createLoginWithClients(client, client, 'token', baseInput);

    expect(outcome.status).toBe(500);
    expect(outcome.body.error).toMatch(/failed to link/i);
    expect(deleteUser).toHaveBeenCalledWith('created-user-1');
  });
});