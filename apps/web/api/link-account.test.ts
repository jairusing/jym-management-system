// @vitest-environment node
import { type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { linkAccountWithClients, type LinkAccountInput } from './link-account';

type FakeOptions = {
  tokenUser?: { id: string } | null;
  role?: string | null;
  member?: { id: string; user_id: string | null; full_name: string } | null;
  memberError?: { message: string } | null;
  users?: { id: string; email: string }[];
  listUsersError?: { message: string } | null;
  alreadyLinkedMember?: { id: string } | null;
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

  const memberMaybeSingle = vi.fn(async () => {
    if (options.member) {
      return { data: options.member, error: null };
    }
    return { data: null, error: options.memberError ?? { message: 'member not found' } };
  });
  const memberEq = vi.fn(() => ({ maybeSingle: memberMaybeSingle }));

  const linkCheckMaybeSingle = vi.fn(async () =>
    options.alreadyLinkedMember
      ? { data: options.alreadyLinkedMember, error: null }
      : { data: null, error: null }
  );
  const linkCheckEq = vi.fn(() => ({ maybeSingle: linkCheckMaybeSingle }));
  const memberSelect = vi.fn((columns: string) => {
    if (columns === 'id') {
      return { eq: linkCheckEq };
    }
    return { eq: memberEq };
  });

  const listUsers = vi.fn(async () =>
    options.listUsersError
      ? { data: null, error: options.listUsersError }
      : { data: { users: options.users ?? [] }, error: null }
  );

  const linkSingle = vi.fn(async () =>
    options.linkError
      ? { data: null, error: options.linkError }
      : { data: { user_id: options.users?.[0]?.id ?? 'linked-user-1' }, error: null }
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
      return {
        select: memberSelect,
        update: linkUpdate
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  const auth = {
    getUser,
    admin: { listUsers }
  };

  const client = { auth, from } as unknown as SupabaseClient;
  return {
    client,
    getUser,
    profileEq,
    memberEq,
    listUsers,
    linkCheckEq,
    linkUpdate,
    linkState
  };
}

const baseInput: LinkAccountInput = {
  memberId: 'member-1',
  email: 'juan@example.com'
};

describe('linkAccountWithClients', () => {
  it('rejects a missing member id', async () => {
    const { client } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await linkAccountWithClients(client, client, 'token', { ...baseInput, memberId: ' ' });
    expect(outcome.status).toBe(400);
    expect(outcome.body.error).toMatch(/member is required/i);
  });

  it('rejects an invalid email', async () => {
    const { client } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await linkAccountWithClients(client, client, 'token', { ...baseInput, email: 'nope' });
    expect(outcome.status).toBe(400);
    expect(outcome.body.error).toMatch(/valid email/i);
  });

  it('rejects a missing token without calling getUser', async () => {
    const { client, getUser } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff' });
    const outcome = await linkAccountWithClients(client, client, null, baseInput);
    expect(outcome.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it('rejects an invalid token', async () => {
    const { client } = buildFakes({ getUserError: { message: 'invalid JWT' } });
    const outcome = await linkAccountWithClients(client, client, 'bad-token', baseInput);
    expect(outcome.status).toBe(401);
  });

  it('rejects a caller who is not owner or staff', async () => {
    const { client, listUsers } = buildFakes({ tokenUser: { id: 'member-9' }, role: 'member' });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(403);
    expect(outcome.body.error).toMatch(/only owner or staff/i);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('rejects when the member does not exist', async () => {
    const { client, listUsers } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff', member: null });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(404);
    expect(outcome.body.error).toMatch(/member not found/i);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('rejects when the member already has a login', async () => {
    const { client, listUsers } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: 'user-1', full_name: 'Juan Dela Cruz' }
    });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(409);
    expect(outcome.body.error).toMatch(/already has a login/i);
    expect(listUsers).not.toHaveBeenCalled();
  });

  it('rejects when no account exists for the email', async () => {
    const { client, linkUpdate } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      users: []
    });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(404);
    expect(outcome.body.error).toMatch(/no account with this email/i);
    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it('rejects when the account is already linked to another member', async () => {
    const { client, linkUpdate } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      users: [{ id: 'juan-user', email: 'juan@example.com' }],
      alreadyLinkedMember: { id: 'member-2' }
    });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(409);
    expect(outcome.body.error).toMatch(/already linked to another member/i);
    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it('links the member to the existing account and returns ok', async () => {
    const { client, listUsers, linkUpdate, linkState } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      users: [{ id: 'juan-user', email: 'juan@example.com' }]
    });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);

    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({ ok: true, email: 'juan@example.com' });

    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 });
    expect(linkUpdate).toHaveBeenCalledWith({ user_id: 'juan-user' });
    expect(linkState.lastEqCall).toEqual(['id', 'member-1']);
  });

  it('fails cleanly when listing users errors', async () => {
    const { client, linkUpdate } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      listUsersError: { message: 'network down' }
    });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(500);
    expect(outcome.body.error).toMatch(/failed to look up/i);
    expect(linkUpdate).not.toHaveBeenCalled();
  });

  it('fails cleanly when linking errors', async () => {
    const { client, linkUpdate } = buildFakes({
      tokenUser: { id: 'staff-1' },
      role: 'staff',
      member: { id: 'member-1', user_id: null, full_name: 'Juan Dela Cruz' },
      users: [{ id: 'juan-user', email: 'juan@example.com' }],
      linkError: { message: 'update failed' }
    });
    const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
    expect(outcome.status).toBe(500);
    expect(outcome.body.error).toMatch(/failed to link/i);
    expect(linkUpdate).toHaveBeenCalledWith({ user_id: 'juan-user' });
  });
});