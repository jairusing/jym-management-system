import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '../../components/ui/PageShell';
import { ActionLink } from '../../components/ui/ActionLink';
import { supabase } from '../../lib/supabase';

export function PasswordResetCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'processing' | 'ready' | 'error'>('processing');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setStatus('error');
      return;
    }

    let cancelled = false;
    const process = async () => {
      const code = new URLSearchParams(location.search).get('code');
      try {
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            // The code may already have been used (e.g. a page refresh after the
            // exchange). Fall back to any session that was persisted earlier.
            const { data } = await client.auth.getSession();
            if (!cancelled) {
              setStatus(data.session ? 'ready' : 'error');
            }
            return;
          }
          // Remove the single-use code from the address bar so a refresh cannot
          // replay it and so it is not left in browser history.
          window.history.replaceState({}, '', window.location.pathname);
        }
        const { data } = await client.auth.getSession();
        if (!cancelled) {
          setStatus(data.session ? 'ready' : 'error');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    };

    void process();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ password_changed_at: new Date().toISOString() }).eq('id', user.id);
    }

    await supabase.auth.signOut();
    navigate('/auth', { replace: true, state: { resetDone: true } });
  };

  return (
    <PageShell title="Reset password" eyebrow="Account" description="Choose a new password for your account." hideNav>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8">
        {status === 'processing' ? (
          <p className="text-sm text-[#A3A3A3]">Validating your reset link…</p>
        ) : status === 'error' ? (
          <div className="space-y-4">
            <p className="text-sm text-[#FF3D00]">This password reset link is invalid or has expired.</p>
            <ActionLink label="Back to sign in" href="/auth" />
          </div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <label className="flex flex-col gap-2 text-sm">
              <span>New password</span>
              <input
                autoComplete="new-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
              />
            </label>
            {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </PageShell>
  );
}