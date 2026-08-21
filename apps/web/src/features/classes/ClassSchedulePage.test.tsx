// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassSchedulePage } from './ClassSchedulePage';
import { mockClassRepository } from './classRepository';
import { mockBookingRepository } from './bookingRepository';
import { mockMemberRepository } from '../members/memberRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ClassSchedulePage />
    </MemoryRouter>
  );
}

async function seedClassAndMember() {
  await mockClassRepository.createClass({
    name: 'Yoga Flow',
    capacity: 10,
    dayOfWeek: 2,
    startTime: '09:00',
    endTime: '10:00'
  });
  await mockMemberRepository.createMember({
    fullName: 'Juan Dela Cruz',
    email: null,
    phone: null,
    joinedAt: '2026-08-01',
    notes: null
  });
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfWeek(date: Date) {
  const day = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

afterEach(() => {
  cleanup();
  mockClassRepository.reset();
  mockBookingRepository.reset();
  mockMemberRepository.reset();
});

describe('ClassSchedulePage', () => {
  it('renders the empty state', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no classes yet/i)).toBeTruthy();
    });
    expect(screen.getByText(/no sessions this week/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add class' })).toBeTruthy();
  });

  it('adds a class via the form', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'HIIT Burn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add class' }));

    await waitFor(() => {
      expect(screen.getByText('HIIT Burn')).toBeTruthy();
    });
    expect(screen.getByText(/Mon · 09:00–10:00 · capacity 10/i)).toBeTruthy();

    const saved = await mockClassRepository.listClasses();
    expect(saved.length).toBe(1);
    expect(saved[0]?.name).toBe('HIIT Burn');
  });

  it('schedules a class for the current week', async () => {
    await seedClassAndMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Schedule this week' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Schedule this week' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scheduled this week' })).toBeTruthy();
    });
    expect(screen.getAllByText('Yoga Flow').length).toBe(2);

    const sessions = await mockClassRepository.listSessions('2000-01-01', '2100-01-01');
    expect(sessions.length).toBe(1);
    expect(sessions[0]?.className).toBe('Yoga Flow');
  });

  it('books a member into a session', async () => {
    await seedClassAndMember();
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Schedule this week' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Schedule this week' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Book a member' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Book a member' }));

    const savedMembers = await mockMemberRepository.listMembers();
    fireEvent.change(screen.getByLabelText('Member'), { target: { value: savedMembers[0]?.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Book' }));

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeTruthy();
    });
    expect(screen.getByText(/1\/10 booked/i)).toBeTruthy();
    expect(screen.getByText('booked')).toBeTruthy();

    const bookings = await mockBookingRepository.listBookings();
    expect(bookings.length).toBe(1);
    expect(bookings[0]?.memberName).toBe('Juan Dela Cruz');
  });

  it('cancels a booking', async () => {
    await seedClassAndMember();
    const classes = await mockClassRepository.listClasses();
    await mockClassRepository.createSession(
      classes[0]?.id as string,
      toDateInput(addDays(startOfWeek(new Date()), 1))
    );
    const members = await mockMemberRepository.listMembers();
    const sessions = await mockClassRepository.listSessions('2000-01-01', '2100-01-01');
    await mockBookingRepository.bookSession(sessions[0]?.id as string, members[0]?.id as string, 'Juan Dela Cruz');
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Cancel Juan Dela Cruz's booking\?/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => {
      expect(screen.getByText(/booking cancelled/i)).toBeTruthy();
    });
    expect(screen.getByText(/0\/10 booked/i)).toBeTruthy();

    const bookings = await mockBookingRepository.listBookings();
    expect(bookings[0]?.status).toBe('cancelled');
  });

  it('shows full state and rejects a booking at capacity', async () => {
    await mockClassRepository.createClass({
      name: 'Yoga Flow',
      capacity: 1,
      dayOfWeek: 2,
      startTime: '09:00',
      endTime: '10:00'
    });
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
      joinedAt: '2026-08-01',
      notes: null
    });
    const classes = await mockClassRepository.listClasses();
    const session = await mockClassRepository.createSession(
      classes[0]?.id as string,
      toDateInput(addDays(startOfWeek(new Date()), 1))
    );
    mockBookingRepository.setSessionCapacity(session.id, 1);
    const members = await mockMemberRepository.listMembers();
    await mockBookingRepository.bookSession(session.id, members[0]?.id as string, 'Juan Dela Cruz');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/1\/1 booked/i)).toBeTruthy();
    });

    const fullButton = screen.getByRole('button', { name: 'Full' });
    expect((fullButton as HTMLButtonElement).disabled).toBe(true);

    const bookings = await mockBookingRepository.listBookings();
    expect(bookings.length).toBe(1);
  });
});