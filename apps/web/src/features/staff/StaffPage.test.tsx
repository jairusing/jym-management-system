// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffPage } from './StaffPage';
import { mockStaffRepository } from './staffRepository';
import { SupabaseStaffRepository } from './supabaseStaffRepository';

const supabaseConfig = vi.hoisted(() => ({ hasSupabaseConfig: false }));

vi.mock('../../lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: null
}));

vi.mock('./supabaseStaffRepository', () => ({
  SupabaseStaffRepository: vi.fn()
}));

const SupabaseStaffRepositoryMock = vi.mocked(SupabaseStaffRepository);

function renderPage() {
  return render(
    <MemoryRouter>
      <StaffPage />
    </MemoryRouter>
  );
}

function seedProfiles() {
  mockStaffRepository.setProfiles([
    {
      id: 'profile-1',
      name: 'Jairus Inge',
      email: 'owner@example.com',
      role: 'owner',
      createdAt: '2026-08-01T00:00:00.000Z'
    },
    {
      id: 'profile-2',
      name: 'Test Staff',
      email: 'owner-test@example.com',
      role: 'staff',
      createdAt: '2026-08-02T00:00:00.000Z'
    }
  ]);
}

function openRowMenu(name: string) {
  const row = screen.getByText(name).closest('li');
  const trigger = row?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
  fireEvent.click(trigger as HTMLButtonElement);
}

afterEach(() => {
  cleanup();
  mockStaffRepository.reset();
  supabaseConfig.hasSupabaseConfig = false;
  SupabaseStaffRepositoryMock.mockReset();
});

describe('StaffPage', () => {
  it('lets the owner list accounts and change roles through confirm', async () => {
    seedProfiles();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/owner@example\.com/)).toBeTruthy();
    });
    expect(screen.getByText(/owner-test@example\.com/)).toBeTruthy();
    expect(screen.queryByRole('combobox')).toBeNull();

    openRowMenu('Test Staff');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Make member' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Set Test Staff's role to member\?/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make member' }));

    await waitFor(async () => {
      const profiles = await mockStaffRepository.listProfiles();
      expect(profiles.find((profile) => profile.id === 'profile-2')?.role).toBe('member');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hides account management from non-owners', async () => {
    mockStaffRepository.setMyRole('member');
    seedProfiles();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/owner access required/i)).toBeTruthy();
    });
    expect(screen.queryByText('owner-test@example.com')).toBeNull();
  });

  it('hides member accounts behind an explicit toggle', async () => {
    mockStaffRepository.setProfiles([
      {
        id: 'profile-1',
        name: 'Jairus Inge',
        email: 'owner@example.com',
        role: 'owner',
        createdAt: '2026-08-01T00:00:00.000Z'
      },
      {
        id: 'profile-2',
        name: 'Test Staff',
        email: 'owner-test@example.com',
        role: 'staff',
        createdAt: '2026-08-02T00:00:00.000Z'
      },
      {
        id: 'profile-3',
        name: 'Stray Signup',
        email: 'stray@example.com',
        role: 'member',
        createdAt: '2026-08-03T00:00:00.000Z'
      }
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/owner@example\.com/)).toBeTruthy();
    });
    expect(screen.queryByText(/stray@example\.com/)).toBeNull();

    const toggle = screen.getByRole('button', { name: 'Show member accounts' });
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/stray@example\.com/)).toBeTruthy();
    });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('blocks demoting the only owner and explains why', async () => {
    seedProfiles();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/owner@example\.com/)).toBeTruthy();
    });

    openRowMenu('Jairus Inge');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Make staff' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/only owner account/i);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    const saved = await mockStaffRepository.listProfiles();
    expect(saved.find((profile) => profile.id === 'profile-1')?.role).toBe('owner');
  });

  it('shows an amber load error instead of mock data when the live load fails', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    SupabaseStaffRepositoryMock.mockImplementation(
      () =>
        ({
          getMyRole: vi.fn().mockRejectedValue(new Error('Network failure')),
          getMyProfileId: vi.fn().mockResolvedValue(null),
          listProfiles: vi.fn().mockRejectedValue(new Error('Network failure')),
          updateRole: vi.fn()
        }) as unknown as SupabaseStaffRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Couldn't load accounts/i);
    });
    const noticeBox = screen.getByRole('alert').closest('div');
    expect(noticeBox?.className).toContain('border-[#FFB300]');
    expect(noticeBox?.className).toContain('bg-[#1A1A1A]');
    expect(screen.queryByText(/owner@example\.com/)).toBeNull();

    SupabaseStaffRepositoryMock.mockImplementation(
      () =>
        ({
          getMyRole: vi.fn().mockResolvedValue('owner'),
          getMyProfileId: vi.fn().mockResolvedValue(null),
          listProfiles: vi.fn().mockResolvedValue([
            {
              id: 'profile-1',
              name: 'Jairus Inge',
              email: 'owner@example.com',
              role: 'owner',
              createdAt: '2026-08-01T00:00:00.000Z'
            }
          ]),
          updateRole: vi.fn()
        }) as unknown as SupabaseStaffRepository
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText(/owner@example\.com/)).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
