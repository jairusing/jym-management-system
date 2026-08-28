// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsPage } from './AnalyticsPage';
import { mockAnalyticsRepository } from './analyticsRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AnalyticsPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockAnalyticsRepository.reset();
});

describe('AnalyticsPage', () => {
  it('renders the four metric cards from demo data', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Attendance')).toBeTruthy();
    });
    expect(screen.getByText('Retention')).toBeTruthy();
    expect(screen.getByText('Churn')).toBeTruthy();
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText(/Top members/)).toBeTruthy();
    expect(screen.getByText('Collected')).toBeTruthy();
  });

  it('switches time windows with the chips', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Attendance')).toBeTruthy();
    });

    const year = screen.getByRole('button', { name: 'This year' });
    expect(year.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(year);
    await waitFor(() => {
      expect(year.getAttribute('aria-pressed')).toBe('true');
    });
    expect(screen.getByRole('button', { name: '30 days' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the empty state when there is no data in the window', async () => {
    mockAnalyticsRepository.setInput({
      checkIns: [],
      memberships: [],
      members: [],
      payments: []
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No data in this window/i)).toBeTruthy();
    });
    expect(screen.queryByText('Attendance')).toBeNull();
  });
});