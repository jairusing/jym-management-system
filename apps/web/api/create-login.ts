import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

export type CreateLoginInput = {
  memberId: string;
  email: string;
  password: string;
};

export type CreateLoginOutcome = {
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

function getClientIp(headers: Record<string, string | string[] | undefined> | undefined): string {
  // In Vercel's deployment model, all requests pass through Vercel's edge network,
  // which sets x-forwarded-for with the real client IP as the first entry.
  // Vercel overwrites this header with the actual client IP, so an attacker cannot
  // spoof it by supplying their own x-forwarded-for value. The first entry is
  // therefore the trusted client IP.
  const forwarded = headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.trim() ?? 'unknown';
  }
  return 'unknown';
}

export async function checkRateLimit(adminClient: SupabaseClient, ip: string, endpoint: string): Promise<boolean> {
  try {
    const { data, error } = await adminClient.rpc('check_rate_limit', {
      p_identifier: ip,
      p_endpoint: endpoint,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS
    });
    if (error) {
      return true;
    }
    return data === true;
  } catch {
    return true;
  }
}

export async function createLoginWithClients(
  anonClient: SupabaseClient,
  adminClient: SupabaseClient,
  accessToken: string | null,
  input: CreateLoginInput
): Promise<CreateLoginOutcome> {
  const memberId = input.memberId.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!memberId) {
    return { status: 400, body: { error: 'Member is required.' } };
  }
  if (!isValidEmail(email)) {
    return { status: 400, body: { error: 'Enter a valid email address.' } };
  }
  if (password.length < 6) {
    return { status: 400, body: { error: 'Password must be at least 6 characters.' } };
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
    return { status: 403, body: { error: 'Only owner or staff can create member logins.' } };
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

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    // email_confirm: true is intentional — staff/owner creates logins for existing
    // members who should receive immediate access. The member does not need to
    // confirm their own email; the staff member already verified the member's
    // identity before creating the login. This preserves the intended "create
    // login for existing member" workflow.
    email_confirm: true,
    user_metadata: { full_name: member.full_name }
  });
  if (createError || !created.user) {
    const message = createError?.message ?? 'unknown error';
    if (/already|exists/i.test(message)) {
      return { status: 409, body: { error: 'An account with this email already exists.' } };
    }
    console.error('create-login: createUser failed:', message);
    return { status: 500, body: { error: 'Failed to create the login. Try again.' } };
  }

  const { data: linked, error: linkError } = await adminClient
    .from('members')
    .update({ user_id: created.user.id })
    .eq('id', member.id)
    .select('user_id')
    .single();
  if (linkError || !linked || linked.user_id !== created.user.id) {
    await adminClient.auth.admin.deleteUser(created.user.id).catch(() => undefined);
    console.error(
      'create-login: linking failed:',
      linkError?.message ?? 'unexpected',
      'member',
      member.id,
      'user',
      created.user.id
    );
    return { status: 500, body: { error: 'Failed to link the login to the member. Try again.' } };
  }

  return { status: 200, body: { ok: true, email } };
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Server is not configured for login creation.' });
    return;
  }

  const body = (typeof req.body === 'object' && req.body !== null ? req.body : {}) as Partial<CreateLoginInput>;
  const accessToken = bearerToken(req.headers?.authorization);

  const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const ip = getClientIp(req.headers);
  if (!(await checkRateLimit(adminClient, ip, '/api/create-login'))) {
    res.status(429).json({ error: 'Too many requests.' });
    return;
  }

  const outcome = await createLoginWithClients(anonClient, adminClient, accessToken, {
    memberId: typeof body.memberId === 'string' ? body.memberId : '',
    email: typeof body.email === 'string' ? body.email : '',
    password: typeof body.password === 'string' ? body.password : ''
  });

  res.status(outcome.status).json(outcome.body);
}