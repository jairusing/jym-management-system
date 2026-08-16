import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

export type LinkAccountInput = {
  memberId: string;
  email: string;
};

export type LinkAccountOutcome = {
  status: number;
  body: { ok?: boolean; email?: string; error?: string };
};

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status(code: number): { json(payload: unknown): void };
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function bearerToken(authorization: string | string[] | undefined) {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (value && value.startsWith('Bearer ')) {
    return value.slice('Bearer '.length);
  }
  return null;
}

export async function linkAccountWithClients(
  anonClient: SupabaseClient,
  adminClient: SupabaseClient,
  accessToken: string | null,
  input: LinkAccountInput
): Promise<LinkAccountOutcome> {
  const memberId = input.memberId.trim();
  const email = normalizeEmail(input.email);

  if (!memberId) {
    return { status: 400, body: { error: 'Member is required.' } };
  }
  if (!isValidEmail(email)) {
    return { status: 400, body: { error: 'Enter a valid email address.' } };
  }
  if (!accessToken) {
    return { status: 401, body: { error: 'Sign in to continue.' } };
  }

  const { data: caller, error: callerError } = await anonClient.auth.getUser(accessToken);
  if (callerError || !caller?.user) {
    return { status: 401, body: { error: 'Sign in to continue.' } };
  }

  const { data: profile, error: profileError } = await anonClient
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .single();
  if (profileError || !profile || (profile.role !== 'owner' && profile.role !== 'staff')) {
    return { status: 403, body: { error: 'Only owner or staff can link member logins.' } };
  }

  const { data: member, error: memberError } = await adminClient
    .from('members')
    .select('id, user_id, full_name')
    .eq('id', memberId)
    .maybeSingle();
  if (memberError || !member) {
    return { status: 404, body: { error: 'Member not found.' } };
  }
  if (member.user_id) {
    return { status: 409, body: { error: 'This member already has a login.' } };
  }

  const { data: list, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  if (listError || !list) {
    console.error('link-account: listUsers failed:', listError?.message ?? 'unknown');
    return { status: 500, body: { error: 'Failed to look up the account. Try again.' } };
  }
  const existingUser = (list.users ?? []).find((user) => normalizeEmail(user.email ?? '') === email);
  if (!existingUser) {
    return {
      status: 404,
      body: { error: 'No account with this email was found. Use Create login if they never signed up.' }
    };
  }

  const { data: linkedMember, error: linkedError } = await adminClient
    .from('members')
    .select('id')
    .eq('user_id', existingUser.id)
    .maybeSingle();
  if (linkedError) {
    return { status: 500, body: { error: 'Failed to check the account. Try again.' } };
  }
  if (linkedMember) {
    return { status: 409, body: { error: 'This account is already linked to another member.' } };
  }

  const { data: linked, error: linkError } = await adminClient
    .from('members')
    .update({ user_id: existingUser.id })
    .eq('id', member.id)
    .select('user_id')
    .single();
  if (linkError || !linked || linked.user_id !== existingUser.id) {
    console.error(
      'link-account: linking failed:',
      linkError?.message ?? 'unexpected',
      'member',
      member.id,
      'user',
      existingUser.id
    );
    return { status: 500, body: { error: 'Failed to link the account to the member. Try again.' } };
  }

  return { status: 200, body: { ok: true, email } };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Server is not configured for login linking.' });
    return;
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Partial<LinkAccountInput>;
  const accessToken = bearerToken(req.headers?.authorization);

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const outcome = await linkAccountWithClients(anonClient, adminClient, accessToken, {
    memberId: typeof body.memberId === 'string' ? body.memberId : '',
    email: typeof body.email === 'string' ? body.email : ''
  });

  res.status(outcome.status).json(outcome.body);
}