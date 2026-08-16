import { supabase } from '../../lib/supabase';
import {
  type CreateLoginInput,
  type LinkAccountInput,
  type MemberAccountRepository
} from './memberAccountRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

export class HttpMemberAccountRepository implements MemberAccountRepository {
  async createLogin(input: CreateLoginInput) {
    await this.post('/api/create-login', input, 'Failed to create the login. Try again.');
  }

  async linkAccount(input: LinkAccountInput) {
    await this.post('/api/link-account', input, 'Failed to link the account. Try again.');
  }

  private async post(path: string, payload: unknown, fallbackMessage: string) {
    const client = ensureSupabase();
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token ?? null;

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(payload)
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error ?? fallbackMessage);
    }
  }
}