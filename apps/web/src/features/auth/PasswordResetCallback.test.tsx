// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordResetCallback } from './PasswordResetCallback';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => {
  const supabase = {
    auth: {
      exchangeCodeForSession: vi.fn(),
      getSession: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn()
    }
  };
  return { hasSupabaseConfig: true, supabase };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/auth/callback" element={<PasswordResetCallback />} />
        <Route path="/auth" element={<div>Sign-in page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PasswordResetCallback', () => {
  it('shows the new password form when a recovery session is present', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: {} as never }, error: null });
    vi.mocked(supabase!.auth.updateUser).mockResolvedValue({ data: { user: {} as never }, error: null });
    vi.mocked(supabase!.auth.signOut).mockResolvedValue({ error: null });

    renderAt('/auth/callback');

    await waitFor(() => {
      expect(screen.getByText('New password')).toBeTruthy();
    });
  });

  it('updates the password and returns to sign in', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: {} as never }, error: null });
    vi.mocked(supabase!.auth.updateUser).mockResolvedValue({ data: { user: {} as never }, error: null });
    vi.mocked(supabase!.auth.signOut).mockResolvedValue({ error: null });

    renderAt('/auth/callback');
    await waitFor(() => {
      expect(screen.getByText('New password')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'newpass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(supabase!.auth.updateUser).toHaveBeenCalledWith({ password: 'newpass123' });
      expect(supabase!.auth.signOut).toHaveBeenCalled();
    });
  });

  it('rejects a mismatched confirmation', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: {} as never }, error: null });

    renderAt('/auth/callback');
    await waitFor(() => {
      expect(screen.getByText('New password')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    });
    expect(supabase!.auth.updateUser).not.toHaveBeenCalled();
  });

  it('shows an invalid-link message when there is no session', async () => {
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderAt('/auth/callback');

    await waitFor(() => {
      expect(screen.getByText('This password reset link is invalid or has expired.')).toBeTruthy();
    });
  });

  it('exchanges the PKCE code when one is present', async () => {
    vi.mocked(supabase!.auth.exchangeCodeForSession).mockResolvedValue({ data: { user: {} as never, session: {} as never }, error: null });
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: {} as never }, error: null });

    renderAt('/auth/callback?code=abc123');

    await waitFor(() => {
      expect(supabase!.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
    });
    await waitFor(() => {
      expect(screen.getByText('New password')).toBeTruthy();
    });
  });

  it('falls back to the persisted session when the PKCE code was already used', async () => {
    vi.mocked(supabase!.auth.exchangeCodeForSession).mockResolvedValue({ data: { user: null, session: null }, error: { name: 'AuthApiError', message: 'Invalid code' } as never });
    vi.mocked(supabase!.auth.getSession).mockResolvedValue({ data: { session: {} as never }, error: null });

    renderAt('/auth/callback?code=already-used');

    await waitFor(() => {
      expect(supabase!.auth.exchangeCodeForSession).toHaveBeenCalledWith('already-used');
    });
    await waitFor(() => {
      expect(screen.getByText('New password')).toBeTruthy();
    });
  });
});