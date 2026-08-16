import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/ui/PageShell';
import { hasSupabaseConfig, supabase, type SupabaseAuthState } from '../../lib/supabase';

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'reset-password'>('sign-in');
  const [resetSent, setResetSent] = useState(false);
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [authState, setAuthState] = useState<SupabaseAuthState>({
    session: null,
    user: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!supabase) {
      setAuthState((current) => ({ ...current, error: 'Supabase configuration is missing.' }));
      return;
    }

    const checkSession = async () => {
      if (!supabase) {
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        navigate('/app');
      }
    };

    void checkSession();
  }, [navigate]);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const code = new URLSearchParams(location.search).get('code');
    if (!code) {
      return;
    }

    // Email confirmation links (with Confirm email enabled) land on the site
    // root with a PKCE code. Exchange it explicitly so the user is signed in
    // after clicking the confirmation link, regardless of the app's entry page.
    let cancelled = false;
    void (async () => {
      const { error } = await supabase!.auth.exchangeCodeForSession(code);
      if (error || cancelled) {
        return;
      }
      window.history.replaceState({}, '', window.location.pathname);
      const { data } = await supabase!.auth.getSession();
      if (!cancelled && data.session) {
        navigate('/app');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.search, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setAuthState((current) => ({ ...current, error: 'Supabase configuration is missing.' }));
      return;
    }

    setAuthState((current) => ({ ...current, loading: true, error: null }));

    if (mode === 'reset-password') {
      if (!supabase) {
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/auth/callback`
      });
      if (error) {
        setAuthState((current) => ({ ...current, loading: false, error: error.message }));
        return;
      }
      setResetSent(true);
      setAuthState((current) => ({ ...current, loading: false, error: null }));
      return;
    }

    if (mode === 'sign-up' && form.password !== confirmPassword) {
      setAuthState((current) => ({ ...current, loading: false, error: 'Passwords do not match.' }));
      return;
    }

    const request = mode === 'sign-up'
      ? supabase.auth.signUp({ email: form.email, password: form.password })
      : supabase.auth.signInWithPassword({ email: form.email, password: form.password });

    const { data, error } = await request;
    if (error) {
      setAuthState((current) => ({ ...current, loading: false, error: error.message }));
      return;
    }

    if (data.session) {
      setAuthState({ session: data.session, user: data.user, loading: false, error: null });
      // Create a minimal profile row for new users. If this fails, do not block
      // the UX — the user is authenticated and can continue. This expects RLS
      // policies to allow inserts by the authenticated user (id = auth.uid()).
      try {
        if (supabase && data.user) {
          await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                name: data.user.email?.split('@')[0] ?? 'Member',
                email: data.user.email,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ]);
        }
      } catch (e) {
        // Non-fatal — log for diagnostics
        console.warn('Could not create profile row after signup', e);
      }

      navigate('/app');
      return;
    }

    if (mode === 'sign-up' && data.user) {
      setConfirmationPending(true);
      setAuthState({ session: null, user: data.user, loading: false, error: null });
      return;
    }

    setAuthState({ session: null, user: data.user, loading: false, error: null });
  };

  return (
    <PageShell
      eyebrow="Phase 1"
      title={mode === 'sign-in' ? 'Sign in' : 'Create account'}
      description="Authentication foundation for Jym Tracker."
      hideNav
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8">
        {!hasSupabaseConfig ? (
          <p className="text-sm text-[#FF3D00]">Supabase environment variables are not configured.</p>
        ) : null}

        {mode === 'reset-password' ? (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm">
              <span>Email</span>
              <input
                autoComplete="email"
                className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                required
              />
            </label>

            {resetSent ? (
              <p className="text-sm text-[#FAFAFA]">If that email is registered, a password reset link has been sent.</p>
            ) : null}
            {authState.error ? <p className="text-sm text-[#FF3D00]">{authState.error}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px" type="submit">
                {authState.loading ? 'Working…' : 'Send reset link'}
              </button>
              <button className="text-sm uppercase tracking-[0.1em] text-[#FAFAFA]" type="button" onClick={() => { setMode('sign-in'); setResetSent(false); setConfirmationPending(false); setConfirmPassword(''); }}>
                Back to sign in
              </button>
            </div>
          </form>
        ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            <span>Email</span>
            <input
              autoComplete="email"
              className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Password</span>
            <input
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
            />
          </label>

          {mode === 'sign-up' ? (
            <label className="flex flex-col gap-2 text-sm">
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
                type="password"
                aria-label="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
          ) : null}

          {mode === 'sign-in' && location.state?.resetDone ? (
            <p className="text-sm text-[#FAFAFA]">Password updated. Sign in with your new password.</p>
          ) : null}
          {confirmationPending ? (
            <p className="text-sm text-[#FAFAFA]">Check your email (and spam folder) — a confirmation link has been sent. Click it to activate your account, then sign in.</p>
          ) : null}
          {authState.error ? <p className="text-sm text-[#FF3D00]">{authState.error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px" type="submit">
              {authState.loading ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>
            <button
              className="text-sm uppercase tracking-[0.1em] text-[#FAFAFA]"
              type="button"
              onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setConfirmationPending(false); setConfirmPassword(''); }}
            >
              {mode === 'sign-in' ? 'Create account' : 'Sign in'}
            </button>
          </div>

          {mode === 'sign-in' ? (
            <div className="mt-2">
              <button className="text-sm uppercase tracking-[0.1em] text-[#A3A3A3] hover:text-[#FF3D00]" type="button" onClick={() => { setMode('reset-password'); setResetSent(false); setConfirmationPending(false); setConfirmPassword(''); }}>
                Forgot password?
              </button>
            </div>
          ) : null}
        </form>
        )}
      </div>
    </PageShell>
  );
}
