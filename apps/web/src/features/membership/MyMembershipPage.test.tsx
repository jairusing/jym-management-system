// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyMembershipPage } from './MyMembershipPage';
import { mockMembershipRepository } from './membershipRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MyMembershipPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockMembershipRepository.reset();
});

describe('MyMembershipPage', () => {
  it('shows the active plan details', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Monthly Pass')).toBeTruthy();
    });
    expect(screen.getByText(/Juan Dela Cruz · active/i)).toBeTruthy();
    expect(screen.getByText(/₱1,500\.00 · started Aug 1, 2026 · until Aug 31, 2026/)).toBeTruthy();
  });

  it('shows the empty state when there is no active membership', async () => {
    mockMembershipRepository.setMyMembership(null);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No active membership')).toBeTruthy();
    });
    expect(screen.getByText(/renew at the front desk/i)).toBeTruthy();
  });
});