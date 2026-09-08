// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthPage } from './AuthPage';

const { supabaseMock } = vi.hoisted(() => {
  const supabaseMock = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: null }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null, user: { id: 'user-1', email: 'test@example.com' } }, error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: null, error: null })
    },
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ data: null, error: null }) })
  };
  return { supabaseMock };
});

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: true,
  supabase: supabaseMock
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setEmail(value: string) {
  fireEvent.change(screen.getAllByLabelText(/Email/i)[0], { target: { value } });
}

function setPassword(value: string) {
  fireEvent.change(screen.getAllByLabelText(/Password/i)[0], { target: { value } });
}

function setConfirmPassword(value: string) {
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value } });
}

describe('AuthPage', () => {
  it('renders the auth shell copy', () => {
    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Sign in to manage the gym/i)).toBeTruthy();
  });

  it('shows an error when sign in fails', async () => {
    const supabaseModule = await import('../../lib/supabase');
    supabaseModule.supabase!.auth.signInWithPassword = vi.fn().mockResolvedValue({ data: { session: null, user: null }, error: { message: 'Invalid credentials' } });

    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    setEmail('test@example.com');
    setPassword('wrong-password');
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
    setEmail('test@example.com');
    setPassword('password123');
    setConfirmPassword('password123');
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
    setEmail('test@example.com');
    setPassword('password123');
    setConfirmPassword('different456');
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/Passwords do not match/i)).toBeTruthy();
    expect(signUp).not.toHaveBeenCalled();
  });

  it('does not reveal account existence on password reset — same generic message regardless of email existence', async () => {
    const supabaseModule = await import('../../lib/supabase');
    const resetMock = vi.fn().mockResolvedValue({ data: null, error: null });
    supabaseModule.supabase!.auth.resetPasswordForEmail = resetMock;

    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    // Switch to reset-password mode
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    // Enter any email — the result is always the same generic message
    setEmail('anyone@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    // The generic non-enumerating message is shown regardless of whether the email exists
    expect(await screen.findByText(/If that email is registered/i)).toBeTruthy();
    expect(resetMock).toHaveBeenCalledWith('anyone@example.com', expect.anything());
  });

  it('shows rate limit error when the server returns a rate limit error on reset', async () => {
    const supabaseModule = await import('../../lib/supabase');
    const resetMock = vi.fn().mockResolvedValue({ data: null, error: { message: 'Rate limit exceeded. Try again in 60 seconds.' } });
    supabaseModule.supabase!.auth.resetPasswordForEmail = resetMock;

    render(
      <BrowserRouter>
        <AuthPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    setEmail('test@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/Rate limit exceeded/i)).toBeTruthy();
  });
});
