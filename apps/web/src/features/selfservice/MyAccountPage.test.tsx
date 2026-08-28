// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyAccountPage } from './MyAccountPage';
import { mockSelfServiceRepository } from './selfServiceRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MyAccountPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockSelfServiceRepository.reset();
});

describe('MyAccountPage', () => {
  it('shows the member record for a linked account', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });
    expect(screen.getByText('active')).toBeTruthy();
    expect(screen.getByText(/Member since/)).toBeTruthy();
    expect(screen.getByText(/juan@example\.com/)).toBeTruthy();
    expect(screen.getByText(/Monthly Pass · until/)).toBeTruthy();

    const statement = screen.getByRole('link', { name: 'My statement' });
    expect(statement.getAttribute('href')).toBe('/app/members/member-demo');
    // The nav and the quick-links card both contain these, so assert each href
    // is present somewhere.
    expect(
      screen.getAllByRole('link', { name: 'My membership' }).some((link) => link.getAttribute('href') === '/app/my-membership')
    ).toBe(true);
    expect(
      screen.getAllByRole('link', { name: 'Classes' }).some((link) => link.getAttribute('href') === '/app/classes')
    ).toBe(true);
  });

  it('shows the unlinked state when no member record matches the login', async () => {
    mockSelfServiceRepository.setMyAccount(null);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No member record linked')).toBeTruthy();
    });
    expect(screen.getByText(/Ask the front desk/i)).toBeTruthy();
  });

  it('shows the demo banner without a live database', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Demo data/i)).toBeTruthy();
    });
  });
});