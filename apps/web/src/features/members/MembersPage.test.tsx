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
    expect(screen.getByText(/0917 123 4567/)).toBeTruthy();
    expect(screen.getByText(/Prefers morning sessions/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeTruthy();

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

  it('deletes a member after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
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

  it('does not delete when confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
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
      expect(screen.getByText('Pedro Reyes')).toBeTruthy();
    });
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(1);
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
      endsAt: '2099-08-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Monthly Pass until Aug 31, 2099/)).toBeTruthy();
    });
  });

  it('flags an expired membership in red', async () => {
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
      startsAt: '2026-07-01',
      endsAt: '2026-07-31',
      status: 'expired'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Expired Jul 31, 2026/)).toBeTruthy();
    });
  });

  it('flags a membership expiring within a week', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    const inFourDays = new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10);
    mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: inFourDays,
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      const text = screen.getByText(/^Expires /);
      expect(text.textContent).toMatch(/^Expires /);
    });
  });

  it('searches members by name, phone, or email', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: 'juan@example.com',
      phone: '0917 111 2222',
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: 'maria@example.com',
      phone: '0917 333 4444',
      joinedAt: '2026-08-02',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/search by name, phone, or email/i), {
      target: { value: '0917 333' }
    });

    await waitFor(() => {
      expect(screen.queryByText('Juan Dela Cruz')).toBeNull();
    });
    expect(screen.getByText('Maria Santos')).toBeTruthy();
    expect(screen.getByText('Showing 1–1 of 1')).toBeTruthy();
  });

  it('filters members by status chips', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-02',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    const maria = members.find((member) => member.fullName === 'Maria Santos');
    if (maria) {
      await mockMemberRepository.setMemberActive(maria.id, false);
    }
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filter: Inactive' }));

    await waitFor(() => {
      expect(screen.queryByText('Juan Dela Cruz')).toBeNull();
    });
    expect(screen.getByText('Maria Santos')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Filter: Active' }));

    await waitFor(() => {
      expect(screen.queryByText('Maria Santos')).toBeNull();
    });
    expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
  });

  it('filters members by membership status', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-02',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    const juan = members.find((member) => member.fullName === 'Juan Dela Cruz');
    if (juan) {
      mockMemberRepository.setMembership(juan.id, {
        planName: 'Monthly Pass',
        startsAt: '2026-08-01',
        endsAt: '2099-08-31',
        status: 'active'
      });
    }
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const select = screen.getByLabelText('Filter by membership');
    fireEvent.change(select, { target: { value: 'expired' } });

    await waitFor(() => {
      expect(screen.getByText(/no members match your filters/i)).toBeTruthy();
    });

    fireEvent.change(select, { target: { value: 'none' } });

    await waitFor(() => {
      expect(screen.queryByText('Juan Dela Cruz')).toBeNull();
    });
    expect(screen.getByText('Maria Santos')).toBeTruthy();

    fireEvent.change(select, { target: { value: 'active' } });

    await waitFor(() => {
      expect(screen.queryByText('Maria Santos')).toBeNull();
    });
    expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
  });

  it('paginates the member list', async () => {
    for (let i = 1; i <= 17; i += 1) {
      await mockMemberRepository.createMember({
        fullName: `Member ${i}`,
        email: null,
        phone: null,
        joinedAt: '2026-08-01',
        notes: null
      });
    }
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Showing 1–15 of 17')).toBeTruthy();
    });

    const next = screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    fireEvent.click(next);

    await waitFor(() => {
      expect(screen.getByText('Showing 16–17 of 17')).toBeTruthy();
    });
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    await waitFor(() => {
      expect(screen.getByText('Showing 1–15 of 17')).toBeTruthy();
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