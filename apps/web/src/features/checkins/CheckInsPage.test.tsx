// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckInsPage } from './CheckInsPage';
import { mockCheckInRepository } from './checkInRepository';
import { phDateToday, phDayEndUtc, phDayStartUtc } from '../../lib/dates';
import { mockMemberRepository } from '../members/memberRepository';

const { scannedCode } = vi.hoisted(() => ({ scannedCode: { current: '' } }));

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
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

  it('checks in a member via QR code', async () => {
    await seedMembers();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });

    const members = await mockMemberRepository.listMembers();
    fireEvent.change(screen.getByLabelText(/QR code or member ID/), {
      target: { value: members[0]?.id }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check in via QR' }));

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

    fireEvent.change(screen.getByLabelText(/QR code or member ID/), {
      target: { value: 'no-such-member' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check in via QR' }));

    await waitFor(() => {
      expect(screen.getByText('No member matches that ID.')).toBeTruthy();
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

    fireEvent.change(screen.getByLabelText(/QR code or member ID/), {
      target: { value: members[0]?.id }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check in via QR' }));

    await waitFor(() => {
      expect(screen.getByText(/membership expired/i)).toBeTruthy();
    });

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
});