// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { mockDashboardRepository } from './dashboardRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockDashboardRepository.reset();
});

describe('DashboardPage', () => {
  it('renders zeroed stats', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/0\.00/).length).toBe(3);
  });

  it('renders attendance numbers and weekly bars', async () => {
    mockDashboardRepository.seed({
      checkIns: [{ checkedInAt: new Date().toISOString() }],
      activeMembers: 3
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('This week')).toBeTruthy();
    });
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText(/daily check-ins/i)).toBeTruthy();
  });

  it('renders revenue and outstanding totals', async () => {
    mockDashboardRepository.seed({
      payments: [{ amount: 1500, paidAt: new Date().toISOString() }],
      invoices: [{ total: 800, status: 'issued' }]
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All time')).toBeTruthy();
    });
    expect(screen.getAllByText(/1,500\.00/).length).toBe(2);
    expect(screen.getAllByText(/800\.00/).length).toBe(1);
  });

  it('excludes void invoices from outstanding', async () => {
    mockDashboardRepository.seed({
      invoices: [
        { total: 800, status: 'void' },
        { total: 400, status: 'paid' }
      ]
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Outstanding')).toBeTruthy();
    });
    expect(screen.getAllByText(/0\.00/).length).toBe(3);
  });
});