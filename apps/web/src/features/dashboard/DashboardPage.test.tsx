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
  ],
  expiringMembers: []
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
      expect(screen.getByText('Peak: 1 check-in in a day')).toBeTruthy();
    });
    expect(screen.queryByText('Last 7 days')).toBeNull();
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText(/daily check-ins/i)).toBeTruthy();
    const checkInsLink = screen.getByRole('link', { name: 'View check-ins' }) as HTMLAnchorElement;
    expect(checkInsLink.getAttribute('href')).toBe('/app/checkins');
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
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
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
      expect(screen.getByRole('alert').textContent).toMatch(/couldn't reach the database/i);
    });
    const loadErrorBox = screen.getByRole('alert').closest('section');
    expect(loadErrorBox?.className).toContain('border-[#FFB300]');
    expect(loadErrorBox?.className).toContain('bg-[#1A1A1A]');
    expect(screen.queryByText(/db unavailable/)).toBeNull();
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
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Today' }));
  });

  it('keeps last-good data and shows an inline banner when a refresh fails', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const getDashboard = vi
      .fn()
      .mockResolvedValueOnce(sampleView)
      .mockRejectedValueOnce(new Error('refresh hiccup'))
      .mockResolvedValueOnce(sampleView);
    SupabaseDashboardRepositoryMock.mockImplementation(
      () => ({ getDashboard }) as unknown as DashboardRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(screen.getByText(/Updated/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("Couldn't refresh the dashboard");
    });
    const refreshErrorBox = screen.getByRole('alert').closest('div');
    expect(refreshErrorBox?.className).toContain('border-[#FFB300]');
    expect(refreshErrorBox?.className).toContain('bg-[#1A1A1A]');
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.queryByText(/refresh hiccup/)).toBeNull();
    expect(getDashboard).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(screen.getByText('Today')).toBeTruthy();
    expect(getDashboard).toHaveBeenCalledTimes(3);
  });

  it('links the revenue and membership stats to their ledgers', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    const paymentsLink = screen.getByRole('link', { name: 'View payments' }) as HTMLAnchorElement;
    expect(paymentsLink.getAttribute('href')).toBe('/app/payments');
    const membersLink = screen.getByRole('link', { name: 'View members' }) as HTMLAnchorElement;
    expect(membersLink.getAttribute('href')).toBe('/app/members');
  });

  it('shows a renewal-reminder banner for memberships expiring within 3 days', async () => {
    const twoDaysFromNow = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    mockDashboardRepository.seed({
      activeMembers: 1,
      expiringMembers: [{ id: 'member-9', fullName: 'Maria Santos', endsAt: twoDaysFromNow }]
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Renewal reminders')).toBeTruthy();
    });
    expect(screen.getByText(/1 membership expires within 3 days/i)).toBeTruthy();
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    const membersLinks = screen.getAllByRole('link', { name: 'View members' }) as HTMLAnchorElement[];
    expect(membersLinks.length).toBeGreaterThanOrEqual(1);
    expect(membersLinks[0]?.getAttribute('href')).toBe('/app/members');
  });

  it('hides the renewal banner when nothing expires soon', async () => {
    mockDashboardRepository.seed({ activeMembers: 2 });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    expect(screen.queryByText('Renewal reminders')).toBeNull();
  });

  it('reserves the accent fill for today’s bar and renders history muted', async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    mockDashboardRepository.seed({
      checkIns: [{ checkedInAt: new Date().toISOString() }, { checkedInAt: twoDaysAgo }],
      activeMembers: 3
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Peak/)).toBeTruthy();
    });

    const chart = screen.getByRole('img', { name: /bar chart of daily check-ins/i });
    const bars = Array.from(chart.querySelectorAll('div[style]')) as HTMLElement[];
    const todayIndex = bars.length - 1;
    expect(bars[todayIndex]?.className).toContain('bg-[#FF3D00]');
    let sawMutedHistoryBar = false;
    for (let i = 0; i < todayIndex; i += 1) {
      expect(bars[i]?.className).not.toContain('bg-[#FF3D00]');
      if (bars[i]?.className.includes('bg-[#A3A3A3]')) {
        sawMutedHistoryBar = true;
      }
    }
    expect(sawMutedHistoryBar).toBe(true);
  });
});