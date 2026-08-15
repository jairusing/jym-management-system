// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  created_at: '2026-01-01T00:00:00.000Z'
};

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn(async () => {}) }));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: signOutMock
  })
}));

beforeEach(() => {
  signOutMock.mockClear();
});

afterEach(() => {
  cleanup();
});

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

  it('validates the new password before updating', () => {
    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getAllByLabelText('New password')[0], { target: { value: 'abc' } });
    fireEvent.change(screen.getAllByLabelText('Confirm new password')[0], { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy();
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