// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembersPage } from './MembersPage';
import { mockMemberRepository } from './memberRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,MOCKQR')
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MembersPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockMemberRepository.reset();
});

describe('MembersPage', () => {
  it('renders the empty state when there are no members', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no members yet/i)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Add member' })).toBeTruthy();
    expect(screen.getByLabelText('Full name')).toBeTruthy();
  });

  it('adds a member via the form', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Juan Dela Cruz' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'juan@example.com' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0917 123 4567' } });
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Prefers morning sessions' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });
    expect(screen.getByText(/Active/i)).toBeTruthy();
    expect(screen.getByText(/0917 123 4567/)).toBeTruthy();
    expect(screen.getByText(/Prefers morning sessions/)).toBeTruthy();

    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(1);
    expect(saved[0]?.fullName).toBe('Juan Dela Cruz');
  });

  it('rejects adding a member without a name', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(screen.getByText('Member name is required.')).toBeTruthy();
    });
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(0);
  });

  it('deactivates and reactivates a member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activate' })).toBeTruthy();
    });
    const afterDeactivate = await mockMemberRepository.listMembers();
    expect(afterDeactivate[0]?.isActive).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deactivate' })).toBeTruthy();
    });
    const afterReactivate = await mockMemberRepository.listMembers();
    expect(afterReactivate[0]?.isActive).toBe(true);
  });

  it('deletes a member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Pedro Reyes',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pedro Reyes')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByText(/no members yet/i)).toBeTruthy();
    });
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(0);
  });

  it('shows an active membership plan and expiry', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Monthly Pass until Aug 31, 2026/)).toBeTruthy();
    });
  });

  it('shows a QR code for a member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show QR' }));

    await waitFor(() => {
      expect(screen.getByAltText(/QR code for Juan Dela Cruz/)).toBeTruthy();
    });
    expect(screen.getByText(/Member ID:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hide QR' }));
    expect(screen.queryByAltText(/QR code for Juan Dela Cruz/)).toBeNull();
  });
});