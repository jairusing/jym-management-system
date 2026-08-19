// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phDateInDays, phDateToday } from '../../lib/dates';
import { DashboardPage } from './DashboardPage';
import { mockDashboardRepository, type DashboardRepository, type DashboardView } from './dashboardRepository';
import { SupabaseDashboardRepository } from './supabaseDashboardRepository';

const supabaseConfig = vi.hoisted(() => ({ hasSupabaseConfig: false }));

vi.mock('../../lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: null
}));

vi.mock('./supabaseDashboardRepository', () => ({
  SupabaseDashboardRepository: vi.fn()
}));

const SupabaseDashboardRepositoryMock = vi.mocked(SupabaseDashboardRepository);

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

const sampleView: DashboardView = {
  stats: {
    attendanceToday: 4,
    attendanceWeek: 12,
    revenueMonth: 5000,
    revenueTotal: 50000,
    outstandingTotal: 2000,
    activeMembers: 10
  },
  weeklyAttendance: [
    ...Array.from({ length: 6 }, (_, i) => {
      const date = phDateInDays(i - 6);
      return { date, label: date.slice(5), count: 0 };
    }),
    { date: phDateToday(), label: 'today', count: 4 }
  ]
};

afterEach(() => {
  cleanup();
  mockDashboardRepository.reset();
  supabaseConfig.hasSupabaseConfig = false;
  SupabaseDashboardRepositoryMock.mockReset();
});

describe('DashboardPage', () => {
  it('renders zeroed stats', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/0\.00/).length).toBe(3);
    expect(screen.queryByText(/Peak/)).toBeNull();
  });

  it('renders attendance numbers and weekly bars', async () => {
    mockDashboardRepository.seed({
      checkIns: [{ checkedInAt: new Date().toISOString() }],
      activeMembers: 3
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Last 7 days')).toBeTruthy();
    });
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText(/daily check-ins/i)).toBeTruthy();
    expect(screen.getByText('Peak: 1 check-in in a day')).toBeTruthy();
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

  it('shows a demo-data notice when no database is configured', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(screen.getByText(/Demo data/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Record a check-in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThanOrEqual(4);
  });

  it('shows an error and Retry when Supabase load fails, then recovers', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const getDashboard = vi
      .fn()
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce(sampleView);
    SupabaseDashboardRepositoryMock.mockImplementation(
      () => ({ getDashboard }) as unknown as DashboardRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("Couldn't load the dashboard.");
    });
    expect(screen.getByText('db unavailable')).toBeTruthy();
    expect(screen.queryByText(/Demo data/i)).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Retry' }));

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(2);
    expect(getDashboard).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Demo data/i)).toBeNull();
    expect(screen.getByText(/Updated/)).toBeTruthy();
  });
});