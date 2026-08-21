// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckInsPage } from './CheckInsPage';
import { mockCheckInRepository } from './checkInRepository';
import { SupabaseCheckInRepository } from './supabaseCheckInRepository';
import { phDateInDays, phDateToday, phDayEndUtc, phDayStartUtc } from '../../lib/dates';
import { mockMemberRepository } from '../members/memberRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

const SupabaseCheckInRepositoryMock = vi.mocked(SupabaseCheckInRepository);
const SupabaseMemberRepositoryMock = vi.mocked(SupabaseMemberRepository);

const { scannedCode, supabaseConfig } = vi.hoisted(() => ({
  scannedCode: { current: '' },
  supabaseConfig: { hasSupabaseConfig: false }
}));

vi.mock('../../lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: null
}));

vi.mock('./supabaseCheckInRepository', () => ({
  SupabaseCheckInRepository: vi.fn()
}));

vi.mock('../members/supabaseMemberRepository', () => ({
  SupabaseMemberRepository: vi.fn()
}));

vi.mock('./qrDecoder', () => ({
  decodeQrFromVideo: vi.fn(() => scannedCode.current)
}));

function stubCamera() {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }]
      })
    }
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CheckInsPage />
    </MemoryRouter>
  );
}

function goToTab(name: string) {
  fireEvent.click(screen.getByRole('tab', { name }));
}

function seedMembers() {
  return Promise.all([
    mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    }),
    mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: '0917 123 4567',
      joinedAt: '2026-08-02',
      notes: null
    })
  ]);
}

afterEach(() => {
  cleanup();
  mockMemberRepository.reset();
  mockCheckInRepository.reset();
  supabaseConfig.hasSupabaseConfig = false;
  SupabaseCheckInRepositoryMock.mockReset();
  SupabaseMemberRepositoryMock.mockReset();
  vi.restoreAllMocks();
});

describe('CheckInsPage', () => {
  it('renders the empty state when there are no members or check-ins', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a name/i)).toBeTruthy();
    });
    expect(screen.getByText(/add members first/i)).toBeTruthy();

    goToTab('Today');
    expect(screen.getByText(/no check-ins yet today/i)).toBeTruthy();
  });

  it('filters members by search query', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });
    expect(screen.getByText('Maria Santos')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/type a name/i), { target: { value: 'maria' } });

    await waitFor(() => {
      expect(screen.queryByText('Juan Dela Cruz')).toBeNull();
    });
    expect(screen.getByText('Maria Santos')).toBeTruthy();
  });

  it('shows the most recent members with an empty search query', async () => {
    for (let i = 1; i <= 6; i += 1) {
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
      expect(screen.getByText(/most recent members — type to search/i)).toBeTruthy();
    });
    expect(screen.getByText('Member 6')).toBeTruthy();
    expect(screen.queryByText('Member 1')).toBeNull();
  });

  it('checks in a member and lists them under today', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const checkInButtons = screen.getAllByRole('button', { name: 'Check in' });
    fireEvent.click(checkInButtons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText(/checked in\./i)).toBeTruthy();
    });

    goToTab('Today');
    expect(screen.getByText(/1 check-in today/i)).toBeTruthy();
    expect(screen.getByText(/manual/i)).toBeTruthy();

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.memberName).toBe('Maria Santos');
  });

  it('rejects checking in an inactive member', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Pedro Reyes',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMemberActive(members[0]?.id as string, false);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pedro Reyes')).toBeTruthy();
    });

    const button = screen.getByRole('button', { name: 'Check in' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('lists check-ins in the attendance history section', async () => {
    await seedMembers();
    await mockCheckInRepository.recordCheckIn({
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz'
    });
    renderPage();

    goToTab('History');

    await waitFor(() => {
      expect(screen.getByText(/1 check-in in the selected range/i)).toBeTruthy();
    });

    const history = await mockCheckInRepository.listCheckIns(
      phDayStartUtc(phDateToday()),
      phDayEndUtc(phDateToday())
    );
    expect(history.length).toBe(1);
    expect(history[0]?.memberName).toBe('Juan Dela Cruz');

    const exportButton = screen.getByRole('button', { name: /export csv/i });
    expect((exportButton as HTMLButtonElement).disabled).toBe(false);
  });

  it('jumps from the today list to the full history', async () => {
    await mockCheckInRepository.recordCheckIn({
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz'
    });
    renderPage();

    goToTab('Today');
    fireEvent.click(screen.getByRole('button', { name: 'View full history' }));

    await waitFor(() => {
      expect(screen.getByText(/1 check-in in the selected range/i)).toBeTruthy();
    });
  });

  it('caps the history list at 200 entries', async () => {
    for (let i = 1; i <= 201; i += 1) {
      await mockCheckInRepository.recordCheckIn({
        memberId: `member-${i}`,
        memberName: `Member ${i}`
      });
    }
    renderPage();

    goToTab('History');

    await waitFor(() => {
      expect(screen.getByText(/Showing the first 200 of 201/i)).toBeTruthy();
    });
  });

  it('asks for the PIN when a member has one, and checks them in on a correct PIN', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Pin Member',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.setMemberPin(member.id, '4321');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pin Member')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    await waitFor(() => {
      expect(screen.getByText(/Enter the PIN for Pin Member/)).toBeTruthy();
    });
    expect((await mockCheckInRepository.listTodayCheckIns()).length).toBe(0);

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '4321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify PIN' }));

    await waitFor(() => {
      expect(screen.getByText(/Pin Member checked in/)).toBeTruthy();
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.method).toBe('manual');
  });

  it('lets staff override the PIN gate when the member forgot their PIN', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Forgot Pin',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.setMemberPin(member.id, '4321');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Forgot Pin')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await waitFor(() => {
      expect(screen.getByText(/Enter the PIN for Forgot Pin/)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Member forgot PIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check in anyway' }));

    await waitFor(() => {
      expect(screen.getByText(/Forgot Pin checked in\./i)).toBeTruthy();
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.method).toBe('manual');
  });

  it('blocks check-in on a wrong PIN, then succeeds with the correct one', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Pin Member',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.setMemberPin(member.id, '4321');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pin Member')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));
    await waitFor(() => {
      expect(screen.getByText(/Enter the PIN for Pin Member/)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '0000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify PIN' }));

    await waitFor(() => {
      expect(screen.getByText('Incorrect PIN.')).toBeTruthy();
    });
    expect((await mockCheckInRepository.listTodayCheckIns()).length).toBe(0);

    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '4321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify PIN' }));

    await waitFor(() => {
      expect(screen.getByText(/Pin Member checked in/)).toBeTruthy();
    });
    expect((await mockCheckInRepository.listTodayCheckIns()).length).toBe(1);
  });

  it('asks for the PIN on the QR path and records the check-in as QR', async () => {
    const member = await mockMemberRepository.createMember({
      fullName: 'Pin Member',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.setMemberPin(member.id, '4321');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pin Member')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Search or member ID/), {
      target: { value: member.id }
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByText(/Enter the PIN for Pin Member/)).toBeTruthy();
    });

fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '4321' } });
    expect(screen.getByLabelText('PIN')).toHaveProperty('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Verify PIN' }));

    await waitFor(() => {
      expect(screen.getByText(/Pin Member checked in/)).toBeTruthy();
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.method).toBe('qr');
  });

  it('checks in a member via QR code', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const members = await mockMemberRepository.listMembers();
    fireEvent.change(screen.getByLabelText(/Search or member ID/), {
      target: { value: members[0]?.id }
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByText(/checked in via QR/i)).toBeTruthy();
    });

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.method).toBe('qr');
  });

  it('checks in a member via the camera scanner', async () => {
    stubCamera();
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const members = await mockMemberRepository.listMembers();
    scannedCode.current = members[0]?.id ?? '';

    fireEvent.click(screen.getByRole('button', { name: 'Scan QR' }));

    await waitFor(() => {
      expect(screen.getByText(/checked in via QR/i)).toBeTruthy();
    });

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.method).toBe('qr');
  });

  it('rejects an unknown QR member ID', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Search or member ID/), {
      target: { value: 'no-such-member' }
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByText('No members match that search.')).toBeTruthy();
    });

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('flags an expired membership on the row and blocks the check-in button', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Ana Lim',
      email: null,
      phone: null,
      joinedAt: '2026-07-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-07-01',
      endsAt: '2026-07-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ana Lim')).toBeTruthy();
    });

    expect(screen.getByText('Expired')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Check in' });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('rejects checking in an expired membership via QR', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Ana Lim',
      email: null,
      phone: null,
      joinedAt: '2026-07-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-07-01',
      endsAt: '2026-07-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ana Lim')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Search or member ID/), {
      target: { value: members[0]?.id }
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByText(/membership expired/i)).toBeTruthy();
    });

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('allows checking in within the 3-day grace period after expiry', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Grace Member',
      email: null,
      phone: null,
      joinedAt: '2026-07-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    const graceEndsAt = phDateInDays(-2);
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-07-01',
      endsAt: phDateInDays(-2),
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Grace Member')).toBeTruthy();
    });

    expect(screen.getByText(/3-day grace until/)).toBeTruthy();
    expect(screen.getByText('Expiring')).toBeTruthy();
    expect(screen.queryByText('Expired')).toBeNull();
    const button = screen.getByRole('button', { name: 'Check in' });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(graceEndsAt).toBe(phDateInDays(-2));

    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText(/checked in\./i)).toBeTruthy();
    });
  });

  it('blocks checking in once the grace period has passed', async () => {
    await mockMemberRepository.createMember({
      fullName: 'No Grace Member',
      email: null,
      phone: null,
      joinedAt: '2026-07-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-07-01',
      endsAt: phDateInDays(-4),
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No Grace Member')).toBeTruthy();
    });

    expect(screen.getByText('Expired')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Check in' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('blocks checking in a member with a paused membership', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Paused Member',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'paused'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Paused Member')).toBeTruthy();
    });
    expect(screen.getByText('Paused')).toBeTruthy();
    const checkInButton = screen.getByRole('button', { name: 'Check in' }) as HTMLButtonElement;
    expect(checkInButton.disabled).toBe(true);

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('blocks checking in a member with a cancelled membership', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Cancelled Member',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'cancelled'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Cancelled Member')).toBeTruthy();
    });
    expect(screen.getByText('Cancelled')).toBeTruthy();
    const checkInButton = screen.getByRole('button', { name: 'Check in' }) as HTMLButtonElement;
    expect(checkInButton.disabled).toBe(true);

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('allows checking in a member with an active membership', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Ben Cruz',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    const members = await mockMemberRepository.listMembers();
    await mockMemberRepository.setMembership(members[0]?.id as string, {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2026-08-31',
      status: 'active'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Ben Cruz')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    await waitFor(() => {
      expect(screen.getByText(/checked in\./i)).toBeTruthy();
    });

    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
    expect(saved[0]?.memberName).toBe('Ben Cruz');
  });

  it('marks a member as checked in today once they have checked in', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const checkInButtons = screen.getAllByRole('button', { name: 'Check in' });
    fireEvent.click(checkInButtons[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(screen.getByText(/checked in\./i)).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText('Checked in today')).toBeTruthy();
      expect(screen.getAllByRole('button', { name: 'Check in' })).toHaveLength(1);
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
  });

  it('does not check in anyone when the search form is submitted', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/type a name/i), { target: { value: 'Maria' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    expect(screen.queryByText(/checked in\./i)).toBeNull();
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    await waitFor(() => {
      expect(screen.getByText(/Maria Santos checked in\./i)).toBeTruthy();
    });
    expect((await mockCheckInRepository.listTodayCheckIns()).length).toBe(1);
  });

  it('moves focus to the first match Check in button when the search form is submitted', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/type a name/i), { target: { value: 'maria' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    const members = await mockMemberRepository.listMembers();
    const maria = members.find((candidate) => candidate.fullName === 'Maria Santos');
    expect(document.activeElement).toBe(document.getElementById(`checkin-button-${maria?.id}`));
    expect((await mockCheckInRepository.listTodayCheckIns()).length).toBe(0);
  });

  it('shows an error and Retry when Supabase load fails, then recovers', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const listMembers = vi
      .fn()
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce([]);
    const listTodayCheckIns = vi
      .fn()
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValueOnce([]);
    const listCheckIns = vi.fn().mockResolvedValue([]);
    SupabaseMemberRepositoryMock.mockImplementation(
      () => ({ listMembers }) as unknown as SupabaseMemberRepository
    );
    SupabaseCheckInRepositoryMock.mockImplementation(
      () => ({ listTodayCheckIns, listCheckIns }) as unknown as SupabaseCheckInRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("Couldn't load check-in data.");
    });
    expect(screen.getByText(/db unavailable/)).toBeTruthy();
    const loadErrorBox = screen.getByRole('alert').closest('div');
    expect(loadErrorBox?.className).toContain('border-[#FFB300]');
    expect(loadErrorBox?.className).toContain('bg-[#1A1A1A]');
    expect(screen.queryByText(/no members yet/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(screen.getByText(/no members yet/i)).toBeTruthy();
    expect(listMembers).toHaveBeenCalledTimes(2);
    expect(listTodayCheckIns).toHaveBeenCalledTimes(2);
  });

  it('shows the amber LoadError with Retry when the history load fails', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const listMembers = vi.fn().mockResolvedValue([]);
    const listTodayCheckIns = vi.fn().mockResolvedValue([]);
    const listCheckIns = vi
      .fn()
      .mockRejectedValueOnce(new Error('history db down'))
      .mockResolvedValueOnce([]);
    SupabaseMemberRepositoryMock.mockImplementation(
      () => ({ listMembers }) as unknown as SupabaseMemberRepository
    );
    SupabaseCheckInRepositoryMock.mockImplementation(
      () => ({ listTodayCheckIns, listCheckIns }) as unknown as SupabaseCheckInRepository
    );
    renderPage();

    goToTab('History');
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain("Couldn't load check-in data.");
    });
    expect(screen.getByText(/history db down/)).toBeTruthy();
    const loadErrorBox = screen.getByRole('alert').closest('div');
    expect(loadErrorBox?.className).toContain('border-[#FFB300]');
    expect(loadErrorBox?.className).toContain('bg-[#1A1A1A]');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(screen.getByText(/no check-ins in this range/i)).toBeTruthy();
    expect(listCheckIns).toHaveBeenCalledTimes(2);
  });

  it('checks in via QR when the member ID form is submitted', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const members = await mockMemberRepository.listMembers();
    fireEvent.change(screen.getByLabelText(/Search or member ID/), {
      target: { value: members[0]?.id }
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByText(/checked in via QR/i)).toBeTruthy();
    });
  });

  it('clears the success banner when a follow-up refresh fails', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    vi.spyOn(mockCheckInRepository, 'listTodayCheckIns').mockRejectedValueOnce(new Error('Network failure'));
    const checkInButtons = screen.getAllByRole('button', { name: 'Check in' });
    fireEvent.click(checkInButtons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Network failure/i);
      expect(screen.queryByRole('status')).toBeNull();
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
  });

  it('blocks a second QR check-in for a member already checked in today', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const checkInButtons = screen.getAllByRole('button', { name: 'Check in' });
    fireEvent.click(checkInButtons[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(screen.getByText(/checked in\./i)).toBeTruthy();
    });

    const members = await mockMemberRepository.listMembers();
    fireEvent.change(screen.getByLabelText(/Search or member ID/), {
      target: { value: members[0]?.id }
    });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('already checked in today');
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
  });

  it('announces feedback with live regions', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const checkInButtons = screen.getAllByRole('button', { name: 'Check in' });
    fireEvent.click(checkInButtons[0] as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/checked in\./i);
    });
    expect(screen.getByRole('status').className).toContain('text-[#22C55E]');
  });

  it('moves Enter focus to the next actionable match when the first is already checked in', async () => {
    const members = await seedMembers();
    await mockCheckInRepository.recordCheckIn({ memberId: members[0]?.id ?? '', memberName: 'Juan Dela Cruz' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
      expect(screen.getAllByText(/checked in today/i).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText(/Search or member ID/), { target: { value: 'a' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      const mariaRow = screen.getByText('Maria Santos').closest('li');
      const mariaButton = mariaRow?.querySelector('button');
      expect(mariaButton).not.toBeNull();
      expect(document.activeElement).toBe(mariaButton);
    });
  });

  it('explains when no matching member can check in instead of silently doing nothing', async () => {
    const members = await seedMembers();
    for (const member of members) {
      await mockCheckInRepository.recordCheckIn({ memberId: member.id, memberName: member.fullName });
    }
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText(/Search or member ID/), { target: { value: 'a' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Check in a member' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/already checked in or blocked/i);
    });
  });

  it('moves focus to a surviving row after a successful delete', async () => {
    const members = await seedMembers();
    await mockCheckInRepository.recordCheckIn({ memberId: members[0]?.id ?? '', memberName: 'Juan Dela Cruz' });
    await mockCheckInRepository.recordCheckIn({ memberId: members[1]?.id ?? '', memberName: 'Maria Santos' });
    renderPage();

    goToTab('Today');
    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
      expect(screen.getByText('Maria Santos')).toBeTruthy();
    });

    const firstRow = screen.getByText('Juan Dela Cruz').closest('li');
    const firstTrigger = firstRow?.querySelector<HTMLButtonElement>('button[id^="checkin-menu-"]');
    fireEvent.click(firstTrigger as HTMLButtonElement);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Check-in deleted.')).toBeTruthy();
    });
    await waitFor(() => {
      const remaining = screen.getByText('Maria Santos').closest('li');
      const trigger = remaining?.querySelector<HTMLButtonElement>('button[id^="checkin-menu-"]');
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('deletes a check-in from the today list after confirming in the modal', async () => {
    await mockCheckInRepository.recordCheckIn({
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz'
    });
    renderPage();

    goToTab('Today');
    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText('Check-in deleted.')).toBeTruthy();
      expect(screen.getByText(/no check-ins yet today/i)).toBeTruthy();
    });
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(0);
  });

  it('keeps a check-in when deletion is cancelled and restores focus to the trigger', async () => {
    await mockCheckInRepository.recordCheckIn({
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz'
    });
    renderPage();

    goToTab('Today');
    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const moreButton = screen.getByRole('button', { name: 'More' });
    moreButton.focus();
    fireEvent.click(moreButton);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.getByText(/1 check-in today/i)).toBeTruthy();
    });
    expect(document.activeElement).toBe(moreButton);
    const saved = await mockCheckInRepository.listTodayCheckIns();
    expect(saved.length).toBe(1);
  });

  it('deletes a check-in from the attendance history after confirming in the modal', async () => {
    await mockCheckInRepository.recordCheckIn({
      memberId: 'member-1',
      memberName: 'Juan Dela Cruz'
    });
    renderPage();

    goToTab('History');
    await waitFor(() => {
      expect(screen.getByText(/1 check-in in the selected range/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.getByText(/0 check-ins in the selected range/i)).toBeTruthy();
    });
    const saved = await mockCheckInRepository.listCheckIns(
      phDayStartUtc(phDateToday()),
      phDayEndUtc(phDateToday())
    );
    expect(saved.length).toBe(0);
  });
});