import { afterEach, describe, expect, it } from 'vitest';
import { mockBookingRepository } from './bookingRepository';

afterEach(() => {
  mockBookingRepository.reset();
});

describe('mockBookingRepository', () => {
  it('rejects a duplicate active booking', async () => {
    mockBookingRepository.setSessionCapacity('session-1', 10);
    await mockBookingRepository.bookSession('session-1', 'member-1', 'Ana');

    await expect(mockBookingRepository.bookSession('session-1', 'member-1', 'Ana')).rejects.toThrow(
      'Member is already booked for this session.'
    );
  });

  it('rebooks a cancelled booking for the same member', async () => {
    mockBookingRepository.setSessionCapacity('session-1', 10);
    const booking = await mockBookingRepository.bookSession('session-1', 'member-1', 'Ana');
    await mockBookingRepository.cancelBooking(booking.id);

    const rebooked = await mockBookingRepository.bookSession('session-1', 'member-1', 'Ana');
    expect(rebooked.status).toBe('booked');
    expect(rebooked.id).toBe(booking.id);

    const bookings = await mockBookingRepository.listBookings();
    expect(bookings.filter((entry) => entry.memberId === 'member-1' && entry.status === 'booked')).toHaveLength(1);
  });

  it('counts a rebook against capacity', async () => {
    mockBookingRepository.setSessionCapacity('session-1', 1);
    const first = await mockBookingRepository.bookSession('session-1', 'member-1', 'Ana');
    await mockBookingRepository.cancelBooking(first.id);
    await mockBookingRepository.bookSession('session-1', 'member-1', 'Ana');

    await expect(mockBookingRepository.bookSession('session-1', 'member-2', 'Bong')).rejects.toThrow(
      'Session is at full capacity.'
    );
  });
});