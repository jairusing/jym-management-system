import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { version as appVersion } from '../../../package.json';
import { ActionLink } from '../../components/ui/ActionLink';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthContext';

type UserRole = 'owner' | 'staff' | 'member';

const roleTone: Record<UserRole, StatusTone> = {
  owner: 'warning',
  staff: 'good',
  member: 'neutral'
};

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);

  const joined = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : null;

  useEffect(() => {
    if (!supabase || !user) return;
    void supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
      if (data?.role) setRole(data.role as UserRole);
    });
  }, [user]);

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (!password || password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.from('profiles').update({ password_changed_at: new Date().toISOString() }).eq('id', user!.id);

    setPassword('');
    setConfirm('');
    setMessage('Password updated successfully.');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <PageShell
      eyebrow="Profile"
      title="Your profile"
      description="Your account details and security."
    >
      <BackLink to="/app" label="Back to dashboard" />
      {user ? (
        <div className="space-y-6">
          <SectionCard title="Account" description={user.email ?? 'Unknown email'}>
            <div className="mt-2 space-y-1 text-sm text-[#A3A3A3]">
              <p>User ID: {user.id}</p>
              {role && <p>Role: <StatusBadge tone={roleTone[role]}>{role}</StatusBadge></p>}
              {joined ? <p>Joined: {joined}</p> : null}
            </div>
            <div className="mt-6">
              <ActionLink onClick={handleSignOut}>Sign out</ActionLink>
            </div>
          </SectionCard>

          <SectionCard title="Change password" description="Update the password used to sign in.">
            <form className="flex flex-col gap-4" onSubmit={handleChangePassword}>
              <label className="flex flex-col gap-2 text-sm">
                <span>New password</span>
                <input
                  autoComplete="new-password"
                  className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span>Confirm new password</span>
                <input
                  autoComplete="new-password"
                  className="border border-[#262626] bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition-colors duration-150 focus:border-[#FF3D00]"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                />
              </label>

              {message ? <p className="text-sm text-[#A3A3A3]">{message}</p> : null}
              {error ? <p className="text-sm text-[#FF3D00]">{error}</p> : null}

              <div>
                <button className="inline-flex items-center border border-[#FF3D00] px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#FF3D00] transition-all duration-150 hover:translate-y-px" type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Update password'}
                </button>
              </div>
            </form>
          </SectionCard>
        </div>
      ) : (
        <SectionCard title="Not signed in">
          <p className="text-sm text-[#A3A3A3]">Sign in to view your profile.</p>
          <div className="mt-6">
            <ActionLink label="Sign in" href="/auth" />
          </div>
        </SectionCard>
      )}

      <p className="border-t border-[#262626] pt-6 text-[0.7rem] uppercase tracking-[0.2em] text-[#A3A3A3]">
        Jym Management System · Version {appVersion}
      </p>
    </PageShell>
  );
}