// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthPage } from './AuthPage';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null })
    }
    ,
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) })
  }
}));

afterEach(() => cleanup());

describe('AuthPage', () => {
  it('renders the auth shell copy', () => {
    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Phase 1/i)).toBeTruthy();
  });

  it('shows an error when sign in fails', async () => {
    const supabaseModule = await import('../../lib/supabase');
    supabaseModule.supabase!.auth.signInWithPassword = vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid credentials' } });

    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getAllByLabelText(/Email/i)[0], { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getAllByLabelText(/Password/i)[0], { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByText(/Invalid credentials/i)).toBeTruthy();
  });

  it('asks the user to confirm their email when sign up requires confirmation', async () => {
    const supabaseModule = await import('../../lib/supabase');
    supabaseModule.supabase!.auth.signUp = vi.fn().mockResolvedValue({ data: { session: null, user: { id: 'user-1', email: 'test@example.com' } }, error: null });

    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getAllByLabelText(/Email/i)[0], { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getAllByLabelText(/Password/i)[0], { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/Check your email/i)).toBeTruthy();
  });

  it('rejects sign up when the passwords do not match', async () => {
    const supabaseModule = await import('../../lib/supabase');
    const signUp = vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null });
    supabaseModule.supabase!.auth.signUp = signUp;

    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    fireEvent.change(screen.getAllByLabelText(/Email/i)[0], { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getAllByLabelText(/Password/i)[0], { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });
});
