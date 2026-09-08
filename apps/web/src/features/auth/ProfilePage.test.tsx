// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

const signOutMock = vi.fn(async () => {});

vi.mock('../../lib/supabase', () => {
  const mockProfileSelect = vi.fn().mockResolvedValue({ data: { role: 'member' }, error: null });
  const mockProfileEq = vi.fn().mockReturnValue({ single: mockProfileSelect });
  const mockProfileSelectFn = vi.fn().mockReturnValue({ eq: mockProfileEq });

  const supabase = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: {} as never }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ data: { user: {} as never }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return { select: mockProfileSelectFn, update: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: null, error: null }) }) };
    })
  };
  return { hasSupabaseConfig: true, supabase };
});

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123', email: 'test@example.com', created_at: '2026-01-01T00:00:00.000Z' },
    signOut: signOutMock
  })
}));

beforeEach(() => {
  signOutMock.mockClear();
});

afterEach(() => {
  cleanup();
});

function getForm() {
  return document.querySelector('form') as HTMLFormElement | null;
}

describe('ProfilePage', () => {
  it('shows account details for a signed-in user', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText('test@example.com')).toBeTruthy();
    expect(screen.getByText(/user-123/)).toBeTruthy();
  });

  it('validates the new password before updating', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getAllByLabelText('New password')[0], { target: { value: 'abc' } });
    fireEvent.change(screen.getAllByLabelText('Confirm new password')[0], { target: { value: 'abc' } });
    const form = getForm();
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy());
  });

  it('rejects password change when current password is empty', async () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    const newPasswordInputs = screen.getAllByLabelText('New password');
    const confirmInputs = screen.getAllByLabelText('Confirm new password');
    const currentPasswordInput = screen.getAllByLabelText('Current password')[0];

    fireEvent.change(currentPasswordInput, { target: { value: '' } });
    fireEvent.change(newPasswordInputs[0], { target: { value: 'newpassword123' } });
    fireEvent.change(confirmInputs[0], { target: { value: 'newpassword123' } });
    const form = getForm();
    if (form) {
      fireEvent.submit(form);
    }
    await waitFor(() => expect(screen.getByText('Current password is required.')).toBeTruthy());
  });

  it('signs out and navigates to the auth page', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
