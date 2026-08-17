// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toDataURL } from 'qrcode';
import { MembersPage } from './MembersPage';
import { mockMemberAccountRepository } from '../memberAccounts/memberAccountRepository';
import { mockMemberRepository } from './memberRepository';
import { mockStaffRepository } from '../staff/staffRepository';
import { SupabaseMemberRepository } from './supabaseMemberRepository';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';

const supabaseConfig = vi.hoisted(() => ({ hasSupabaseConfig: false }));

vi.mock('../../lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: null
}));

vi.mock('qrcode', () => ({
  toDataURL: vi.fn(async () => 'data:image/png;base64,MOCKQR')
}));

vi.mock('./supabaseMemberRepository', () => ({
  SupabaseMemberRepository: vi.fn()
}));

vi.mock('../staff/supabaseStaffRepository', () => ({
  SupabaseStaffRepository: vi.fn()
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <MembersPage />
    </MemoryRouter>
  );
}

function openRowMenu(memberName: string) {
  const row = screen.getByText(memberName).closest('li');
  if (!row) {
    throw new Error(`row for ${memberName} not found`);
  }
  fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'More' }));
}

afterEach(() => {
  cleanup();
  mockMemberRepository.reset();
  mockMemberAccountRepository.reset();
  mockStaffRepository.reset();
  supabaseConfig.hasSupabaseConfig = false;
  vi.mocked(SupabaseMemberRepository).mockReset();
  vi.mocked(SupabaseStaffRepository).mockReset();
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
    openRowMenu('Juan Dela Cruz');
    expect(screen.getByRole('menuitem', { name: 'Deactivate' })).toBeTruthy();

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

  it('rejects adding a member with a duplicate email or phone', async () => {
    await mockMemberRepository.createMember({
      fullName: 'First Member',
      email: 'shared@example.com',
      phone: '0917 000 1111',
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Second Member' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'SHARED@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(screen.getByText('A member with this email already exists.')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Third Member' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0917 000 1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() => {
      expect(screen.getByText('A member with this phone number already exists.')).toBeTruthy();
    });
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(1);
  });

  it('sets a member PIN', async () => {
    const member = await mockMemberRepository.createMember({
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

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set PIN' }));
    await waitFor(() => {
      expect(screen.getByLabelText('PIN')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }));

    await waitFor(() => {
      expect(screen.getByText(/PIN saved for Maria Santos/)).toBeTruthy();
    });
    expect(await mockMemberRepository.verifyMemberPin(member.id, '1234')).toBe('ok');
    expect(await mockMemberRepository.verifyMemberPin(member.id, '9999')).toBe('fail');
  });

  it('rejects a PIN that is not 4-6 digits', async () => {
    const member = await mockMemberRepository.createMember({
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

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Set PIN' }));
    await waitFor(() => {
      expect(screen.getByLabelText('PIN')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save PIN' }));

    await waitFor(() => {
      expect(screen.getByText('PIN must be 4-6 digits.')).toBeTruthy();
    });
    expect(await mockMemberRepository.verifyMemberPin(member.id, '12')).toBe('missing');
  });

  it('pauses, resumes, and cancels a membership', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    mockMemberRepository.setMembership(member.id, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Monthly Pass until Aug 31, 2026')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause' }));
    expect(
      screen.getByText(/Pause Maria Santos's membership\? Monthly Pass until Aug 31, 2026\. Check-ins will be blocked until resumed\./)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => {
      expect(screen.getByText('Paused (Monthly Pass)')).toBeTruthy();
    });
    expect(screen.getByText('Paused')).toBeTruthy();
    openRowMenu('Maria Santos');
    expect(screen.getByRole('menuitem', { name: 'Resume' })).toBeTruthy();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Resume' }));
    expect(
      screen.getByText(/Resume Maria Santos's membership\? Monthly Pass until Aug 31, 2026\./)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => {
      expect(screen.getByText('Monthly Pass until Aug 31, 2026')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cancel membership' }));
    expect(
      screen.getByText(/Cancel Maria Santos's membership\? Monthly Pass until Aug 31, 2026\. This cannot be undone/)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel membership' }));
    await waitFor(() => {
      expect(screen.getByText('Cancelled (Monthly Pass)')).toBeTruthy();
    });
    expect(screen.getByText('Cancelled')).toBeTruthy();

    const saved = await mockMemberRepository.listMembers();
    expect(saved[0]?.membership?.status).toBe('cancelled');
  });

  it('shows Pausing… while the pause request is in flight', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    mockMemberRepository.setMembership(member.id, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Monthly Pass until Aug 31, 2026')).toBeTruthy();
    });

    let release: () => void = () => {};
    const original = mockMemberRepository.setMembershipStatus.bind(mockMemberRepository);
    vi.spyOn(mockMemberRepository, 'setMembershipStatus').mockImplementationOnce((memberId, status) => {
      const promise = new Promise<void>((resolve) => { release = resolve; });
      return promise.then(() => original(memberId, status));
    });
    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByRole('button', { name: 'Pausing…' })).toBeTruthy();
    release();
    await waitFor(() => {
      expect(screen.getByText('Paused (Monthly Pass)')).toBeTruthy();
    });
  });

  it('keeps the membership status when the pause confirmation is declined', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    mockMemberRepository.setMembership(member.id, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Monthly Pass until Aug 31, 2026')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await waitFor(() => {
      expect(screen.getByText('Monthly Pass until Aug 31, 2026')).toBeTruthy();
    });
    expect(screen.queryByRole('menuitem', { name: 'Resume' })).toBeNull();
  });

  it('deactivates and reactivates a member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Activate' })).toBeNull();
    });
    const afterDeactivate = await mockMemberRepository.listMembers();
    expect(afterDeactivate[0]?.isActive).toBe(false);
    expect(document.activeElement).toBe(document.getElementById(`member-menu-${members[0]?.id}`));

    openRowMenu('Maria Santos');
    expect(screen.getByRole('menuitem', { name: 'Activate' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Activate' }));
    expect(screen.getByText('Activate Maria Santos?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const afterReactivate = await mockMemberRepository.listMembers();
    expect(afterReactivate[0]?.isActive).toBe(true);
  });

  it('warns that check-ins will be blocked when deactivating a member with an active membership', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    mockMemberRepository.setMembership(member.id, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    expect(screen.getByText('Deactivate Maria Santos?')).toBeTruthy();
    expect(
      screen.getByText(/They have an active Monthly Pass \(until Aug 31, 2026\) — check-ins will be blocked immediately\./)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Activate' })).toBeNull();
    });
    openRowMenu('Maria Santos');
    expect(screen.getByRole('menuitem', { name: 'Activate' })).toBeTruthy();
  });

  it('keeps the member active when deactivation is declined', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(document.activeElement).toBe(document.getElementById(`member-menu-${members[0]?.id}`));
    openRowMenu('Maria Santos');
    expect(screen.getByRole('menuitem', { name: 'Deactivate' })).toBeTruthy();
    const saved = await mockMemberRepository.listMembers();
    expect(saved[0]?.isActive).toBe(true);
  });

  it('deletes a member after confirmation', async () => {
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

    openRowMenu('Pedro Reyes');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByText(/Delete Pedro Reyes\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByText(/no members yet/i)).toBeTruthy();
    });
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(0);
  });

  it('does not delete when confirmation is declined', async () => {
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

    openRowMenu('Pedro Reyes');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('Pedro Reyes')).toBeTruthy();
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(1);
  });

  it('dismisses the confirmation modal when the backdrop is clicked', async () => {
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

    openRowMenu('Pedro Reyes');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('dialog'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByText('Pedro Reyes')).toBeTruthy();
    const saved = await mockMemberRepository.listMembers();
    expect(saved.length).toBe(1);
  });

  it('keeps only one row menu open at a time', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.createMember({
      fullName: 'Pedro Reyes',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    openRowMenu('Maria Santos');
    openRowMenu('Pedro Reyes');
    const expanded = screen
      .getAllByRole('button', { name: 'More' })
      .filter((button) => button.getAttribute('aria-expanded') === 'true');
    expect(expanded.length).toBe(1);
    expect(screen.getAllByRole('menuitem', { name: 'Show QR' }).length).toBe(1);
  });

  it('submits the create-login panel with Enter', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create login' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret123' } });
    const form = screen.getByLabelText('Login email').closest('form');
    if (!form) {
      throw new Error('login form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Login created for juan@example.com/)).toBeTruthy();
    });
    expect(mockMemberAccountRepository.calls).toEqual([
      { memberId: expect.stringMatching(/^member-/), email: 'juan@example.com', password: 'secret123' }
    ]);
  });

  it('submits the link-account panel with Enter', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Link existing' }));
    const form = screen.getByLabelText('Account email').closest('form');
    if (!form) {
      throw new Error('link form not found');
    }
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Linked to juan@example.com/)).toBeTruthy();
    });
    expect(mockMemberAccountRepository.linkCalls).toEqual([
      { memberId: expect.stringMatching(/^member-/), email: 'juan@example.com' }
    ]);
  });

  it('keeps the modal open with the error when reactivation fails, then retries', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMemberActive(members[0]?.id as string, false);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    vi.spyOn(mockMemberRepository, 'setMemberActive').mockRejectedValueOnce(new Error('Network failure'));
    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Activate' }));
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeTruthy();
    });
    expect(screen.queryByRole('dialog')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    const saved = await mockMemberRepository.listMembers();
    expect(saved[0]?.isActive).toBe(true);
  });

  it('keeps the modal open with the error when an action fails, then retries', async () => {
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

    vi.spyOn(mockMemberRepository, 'deleteMember').mockRejectedValueOnce(new Error('Network failure'));
    openRowMenu('Pedro Reyes');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeTruthy();
    });
    expect(screen.queryByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/no members yet/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(screen.getByText(/no members yet/i)).toBeTruthy();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
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

    openRowMenu('Juan Dela Cruz');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show QR' }));

    await waitFor(() => {
      expect(screen.getByAltText(/QR code for Juan Dela Cruz/)).toBeTruthy();
    });
    expect(screen.getByText(/Member ID:/)).toBeTruthy();

    openRowMenu('Juan Dela Cruz');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide QR' }));
    expect(screen.queryByAltText(/QR code for Juan Dela Cruz/)).toBeNull();
  });

  it('does not let a stale QR resolution overwrite a newer panel', async () => {
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
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    let resolveJuan: (value: string) => void = () => {};
    vi.mocked(toDataURL).mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveJuan = resolve; })
    );
    openRowMenu('Juan Dela Cruz');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show QR' }));

    openRowMenu('Maria Santos');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show QR' }));

    await waitFor(() => {
      expect(screen.getByAltText(/QR code for Maria Santos/)).toBeTruthy();
    });
    expect(screen.getByAltText(/QR code for Maria Santos/).getAttribute('src')).toBe(
      'data:image/png;base64,MOCKQR'
    );

    resolveJuan('data:image/png;base64,JUANQR');
    await waitFor(() => {
      expect(screen.getByAltText(/QR code for Maria Santos/).getAttribute('src')).toBe(
        'data:image/png;base64,MOCKQR'
      );
    });
    expect(screen.queryByAltText(/QR code for Juan Dela Cruz/)).toBeNull();
  });

  it('navigates the row menu with arrow keys', async () => {
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

    openRowMenu('Maria Santos');
    const first = screen.getByRole('menuitem', { name: 'Show QR' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Set PIN' }));

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Set PIN' }), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Create login' }));

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Create login' }), { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete' }));

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Delete' }), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Deactivate' }));

    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Deactivate' }), { key: 'Home' });
    expect(document.activeElement).toBe(first);
  });

  it('shows a Create login button only for members without an account', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    mockMemberRepository.linkAccount(members[0]?.id as string, 'user-1');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });
    expect(screen.queryByRole('menuitem', { name: 'Create login' })).toBeNull();
  });

  it('creates a login for a walk-in member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create login' }));
    expect((screen.getByLabelText('Login email') as HTMLInputElement).value).toBe('juan@example.com');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => {
      expect(screen.getByText(/Login created for juan@example.com/)).toBeTruthy();
    });
    expect(mockMemberAccountRepository.calls).toEqual([
      { memberId: expect.stringMatching(/^member-/), email: 'juan@example.com', password: 'secret123' }
    ]);
  });

  it('rejects a login password shorter than 6 characters', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create login' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => {
      expect(screen.getByText('Password must be at least 6 characters.')).toBeTruthy();
    });
    expect(mockMemberAccountRepository.calls.length).toBe(0);
  });

  it('rejects mismatched passwords', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create login' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => {
      expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    });
    expect(mockMemberAccountRepository.calls.length).toBe(0);
  });

  it('shows the server error when creating a login fails', async () => {
    vi.spyOn(mockMemberAccountRepository, 'createLogin').mockRejectedValueOnce(
      new Error('An account with this email already exists.')
    );
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Create login' }));
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists.')).toBeTruthy();
    });
  });

  it('hides the Deactivate button for staff', async () => {
    mockStaffRepository.setMyRole('staff');
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
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).toBeNull();
  });

  it('lets staff reactivate an inactive member', async () => {
    mockStaffRepository.setMyRole('staff');
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMemberActive(members[0]?.id as string, false);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });
    openRowMenu('Maria Santos');
    expect(screen.getByRole('menuitem', { name: 'Activate' })).toBeTruthy();
  });

  it('links an existing account to a walk-in member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Link existing' }));
    expect((screen.getByLabelText('Account email') as HTMLInputElement).value).toBe('juan@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Link account' }));

    await waitFor(() => {
      expect(screen.getByText(/Linked to juan@example.com/)).toBeTruthy();
    });
    expect(mockMemberAccountRepository.linkCalls).toEqual([
      { memberId: expect.stringMatching(/^member-/), email: 'juan@example.com' }
    ]);
  });

  it('shows the server error when linking an account fails', async () => {
    vi.spyOn(mockMemberAccountRepository, 'linkAccount').mockRejectedValueOnce(
      new Error('No account with this email was found.')
    );
    await mockMemberRepository.createMember({
      fullName: 'Walk In Juan',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Walk In Juan')).toBeTruthy();
    });

    openRowMenu('Walk In Juan');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Link existing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Link account' }));

    await waitFor(() => {
      expect(screen.getByText('No account with this email was found.')).toBeTruthy();
    });
    expect(mockMemberAccountRepository.linkCalls.length).toBe(0);
  });

  it('shows an error and lets the user retry when members fail to load', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const listMembers = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce([
        {
          id: 'member-1',
          userId: null,
          fullName: 'Juan Dela Cruz',
          email: null,
          phone: null,
          joinedAt: '2026-08-01',
          notes: null,
          isActive: true,
          membership: null,
          createdAt: '2026-08-01T00:00:00+08:00'
        }
      ]);
    vi.mocked(SupabaseMemberRepository).mockImplementation(
      () => ({ listMembers }) as unknown as SupabaseMemberRepository
    );
    vi.mocked(SupabaseStaffRepository).mockImplementation(
      () => ({ getMyRole: vi.fn(async () => 'owner') }) as unknown as SupabaseStaffRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Network failure/)).toBeTruthy();
    });
    expect(screen.queryByText(/no members yet/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });
    expect(screen.queryByText(/Network failure/)).toBeNull();
  });
});