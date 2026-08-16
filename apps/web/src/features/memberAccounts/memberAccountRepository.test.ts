// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import { HttpMemberAccountRepository } from './httpMemberAccountRepository';
import { mockMemberAccountRepository } from './memberAccountRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: true,
  supabase: { auth: { getSession: vi.fn() } }
}));

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: vi.fn(async () => body) };
}

afterEach(() => {
  mockMemberAccountRepository.reset();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('MockMemberAccountRepository', () => {
  it('creates a login and normalizes the email', async () => {
    await mockMemberAccountRepository.createLogin({
      memberId: 'member-1',
      email: '  Juan@Example.com ',
      password: 'secret123'
    });
    expect(mockMemberAccountRepository.calls).toEqual([
      { memberId: 'member-1', email: 'juan@example.com', password: 'secret123' }
    ]);
  });

  it('rejects a missing email', async () => {
    await expect(
      mockMemberAccountRepository.createLogin({ memberId: 'member-1', email: ' ', password: 'secret123' })
    ).rejects.toThrow('Email is required.');
    expect(mockMemberAccountRepository.calls.length).toBe(0);
  });

  it('rejects an invalid email', async () => {
    await expect(
      mockMemberAccountRepository.createLogin({ memberId: 'member-1', email: 'nope', password: 'secret123' })
    ).rejects.toThrow('Enter a valid email address.');
    expect(mockMemberAccountRepository.calls.length).toBe(0);
  });

  it('rejects a short password', async () => {
    await expect(
      mockMemberAccountRepository.createLogin({ memberId: 'member-1', email: 'a@b.co', password: 'abc' })
    ).rejects.toThrow('Password must be at least 6 characters.');
    expect(mockMemberAccountRepository.calls.length).toBe(0);
  });

  it('links an existing account and normalizes the email', async () => {
    await mockMemberAccountRepository.linkAccount({
      memberId: 'member-1',
      email: '  Juan@Example.com '
    });
    expect(mockMemberAccountRepository.linkCalls).toEqual([
      { memberId: 'member-1', email: 'juan@example.com' }
    ]);
  });

  it('rejects a missing email when linking', async () => {
    await expect(
      mockMemberAccountRepository.linkAccount({ memberId: 'member-1', email: ' ' })
    ).rejects.toThrow('Email is required.');
    expect(mockMemberAccountRepository.linkCalls.length).toBe(0);
  });

  it('rejects an invalid email when linking', async () => {
    await expect(
      mockMemberAccountRepository.linkAccount({ memberId: 'member-1', email: 'nope' })
    ).rejects.toThrow('Enter a valid email address.');
    expect(mockMemberAccountRepository.linkCalls.length).toBe(0);
  });
});

describe('HttpMemberAccountRepository', () => {
  it('posts to the create-login endpoint with the session token', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'jwt-token' } as never },
      error: null
    });
    fetchMock.mockResolvedValue(respond(200, { ok: true, email: 'juan@example.com' }));
    vi.stubGlobal('fetch', fetchMock);

    const repo = new HttpMemberAccountRepository();
    await repo.createLogin({ memberId: 'member-1', email: 'juan@example.com', password: 'secret123' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/create-login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
        body: JSON.stringify({ memberId: 'member-1', email: 'juan@example.com', password: 'secret123' })
      })
    );
  });

  it('throws the server error message on failure', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    });
    fetchMock.mockResolvedValue(respond(409, { error: 'An account with this email already exists.' }));
    vi.stubGlobal('fetch', fetchMock);

    const repo = new HttpMemberAccountRepository();
    await expect(
      repo.createLogin({ memberId: 'member-1', email: 'juan@example.com', password: 'secret123' })
    ).rejects.toThrow('An account with this email already exists.');
  });

  it('throws a generic error when the response is not JSON', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    });
    fetchMock.mockResolvedValue({ ok: false, status: 404, json: vi.fn(async () => { throw new Error('not json'); }) });
    vi.stubGlobal('fetch', fetchMock);

    const repo = new HttpMemberAccountRepository();
    await expect(
      repo.createLogin({ memberId: 'member-1', email: 'juan@example.com', password: 'secret123' })
    ).rejects.toThrow('Failed to create the login. Try again.');
  });

  it('posts to the link-account endpoint with the session token', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'jwt-token' } as never },
      error: null
    });
    fetchMock.mockResolvedValue(respond(200, { ok: true, email: 'juan@example.com' }));
    vi.stubGlobal('fetch', fetchMock);

    const repo = new HttpMemberAccountRepository();
    await repo.linkAccount({ memberId: 'member-1', email: 'juan@example.com' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/link-account',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-token' }),
        body: JSON.stringify({ memberId: 'member-1', email: 'juan@example.com' })
      })
    );
  });

  it('throws the server error message when linking fails', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    });
    fetchMock.mockResolvedValue(respond(404, { error: 'No account with this email was found.' }));
    vi.stubGlobal('fetch', fetchMock);

    const repo = new HttpMemberAccountRepository();
    await expect(repo.linkAccount({ memberId: 'member-1', email: 'juan@example.com' })).rejects.toThrow(
      'No account with this email was found.'
    );
  });
});