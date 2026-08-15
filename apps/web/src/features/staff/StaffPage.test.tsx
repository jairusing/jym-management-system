// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StaffPage } from './StaffPage';
import { mockStaffRepository } from './staffRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

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
      email: 'jairusingente3@gmail.com',
      role: 'owner',
      createdAt: '2026-08-01T00:00:00.000Z'
    },
    {
      id: 'profile-2',
      name: 'Test Staff',
      email: 'jms.test@demo.jms',
      role: 'staff',
      createdAt: '2026-08-02T00:00:00.000Z'
    }
  ]);
}

afterEach(() => {
  cleanup();
  mockStaffRepository.reset();
});

describe('StaffPage', () => {
  it('lets the owner list accounts and change roles', async () => {
    seedProfiles();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/jairusingente3@gmail\.com/)).toBeTruthy();
    });
    expect(screen.getByText(/jms\.test@demo\.jms/)).toBeTruthy();
    expect(screen.getAllByRole('combobox').length).toBe(2);

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.change(screen.getAllByRole('combobox')[1] as HTMLSelectElement, {
      target: { value: 'member' }
    });

    await waitFor(async () => {
      const profiles = await mockStaffRepository.listProfiles();
      expect(profiles.find((profile) => profile.id === 'profile-2')?.role).toBe('member');
    });
  });

  it('hides account management from non-owners', async () => {
    mockStaffRepository.setMyRole('member');
    seedProfiles();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/owner access required/i)).toBeTruthy();
    });
    expect(screen.queryByText('jms.test@demo.jms')).toBeNull();
  });
});