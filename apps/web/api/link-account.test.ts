// @vitest-environment node
import { type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { linkAccountWithClients, checkRateLimit, type LinkAccountInput } from './link-account';

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
  const getUser = vi.fn();
  getUser.mockImplementation(async () => {
    if (options.getUserError) {
      return { data: null, error: options.getUserError };
    }
    return { data: { user: options.tokenUser ?? null }, error: null };
  });

  const profileSingle = vi.fn();
  profileSingle.mockImplementation(async () =>
    options.role
      ? { data: { role: options.role }, error: null }
      : { data: null, error: { message: 'profile not found' } }
  );
  const profileEq = vi.fn().mockReturnValue({ single: profileSingle });
  const profileSelect = vi.fn().mockReturnValue({ eq: profileEq });

  const memberMaybeSingle = vi.fn();
  memberMaybeSingle.mockImplementation(async () =>
    options.member
      ? { data: options.member, error: null }
      : { data: null, error: options.memberError ?? { message: 'member not found' } }
  );
  const memberEq = vi.fn().mockReturnValue({ maybeSingle: memberMaybeSingle });
  const linkCheckMaybeSingle = vi.fn();
  linkCheckMaybeSingle.mockImplementation(async () =>
    options.alreadyLinkedMember
      ? { data: options.alreadyLinkedMember, error: null }
      : { data: null, error: null }
  );
  const linkCheckEq = vi.fn().mockReturnValue({ maybeSingle: linkCheckMaybeSingle });
  const memberSelect = vi.fn((columns: string) => {
    if (columns === 'id') {
      return { eq: linkCheckEq };
    }
    return { eq: memberEq };
  });

  const listUsers = vi.fn();
  listUsers.mockImplementation(async () =>
    options.listUsersError
      ? { data: null, error: options.listUsersError }
      : { data: { users: options.users ?? [] }, error: null }
  );

  const linkSingle = vi.fn();
  linkSingle.mockImplementation(async () =>
    options.linkError
      ? { data: null, error: options.linkError }
      : { data: { user_id: options.users?.[0]?.id ?? 'linked-user-1' }, error: null }
  );
  const linkSelect = vi.fn().mockReturnValue({ single: linkSingle });
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

  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

  const auth = {
    getUser,
    admin: { listUsers }
  };

  const client = { auth, from, rpc } as unknown as SupabaseClient;
  return {
    client,
    getUser,
    profileEq,
    memberEq,
    listUsers,
    linkCheckEq,
    linkUpdate,
    linkState,
    memberMaybeSingle,
    rpc
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

describe('link-account rate limiting', () => {
    it('first request is allowed', async () => {
      const { client, rpc } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff', users: [{ id: 'juan-user', email: 'juan@example.com' }] });
      rpc.mockResolvedValue({ data: true, error: null });
      const result = await checkRateLimit(client, '192.168.1.1', '/api/link-account');
      expect(result).toBe(true);
      expect(rpc).toHaveBeenCalledWith('check_rate_limit', expect.objectContaining({ p_identifier: '192.168.1.1', p_endpoint: '/api/link-account', p_window_seconds: 60, p_max_requests: 5 }));
    });

    it('requests beyond the limit are rejected', async () => {
      const { client, rpc } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff', users: [{ id: 'juan-user', email: 'juan@example.com' }] });
      rpc.mockResolvedValue({ data: false, error: null });
      const result = await checkRateLimit(client, '192.168.1.1', '/api/link-account');
      expect(result).toBe(false);
    });

    it('different identifiers have separate limits', async () => {
      const { client, rpc } = buildFakes({ tokenUser: { id: 'staff-1' }, role: 'staff', users: [{ id: 'juan-user', email: 'juan@example.com' }] });
      rpc.mockResolvedValue({ data: true, error: null });
      const result1 = await checkRateLimit(client, '192.168.1.1', '/api/link-account');
      const result2 = await checkRateLimit(client, '10.0.0.1', '/api/link-account');
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('link-account handler authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { client, getUser } = buildFakes({ tokenUser: null, role: null });
      getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid token' } });
      const outcome = await linkAccountWithClients(client, client, null, baseInput);
      expect(outcome.status).toBe(401);
    });

    it('rejects non-owner/staff requests with 403', async () => {
      const { client } = buildFakes({ tokenUser: { id: 'member-9' }, role: 'member' });
      const outcome = await linkAccountWithClients(client, client, 'token', baseInput);
      expect(outcome.status).toBe(403);
      expect(outcome.body.error).toMatch(/only owner or staff/i);
    });
  });
