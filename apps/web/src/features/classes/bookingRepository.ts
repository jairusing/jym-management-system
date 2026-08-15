export type BookingStatus = 'booked' | 'cancelled' | 'attended' | 'no_show';

export type Booking = {
  id: string;
  sessionId: string;
  memberId: string;
  memberName: string;
  status: BookingStatus;
  bookedAt: string;
};

export interface BookingRepository {
  listBookings(): Promise<Booking[]>;
  bookSession(sessionId: string, memberId: string, memberName?: string): Promise<Booking>;
  cancelBooking(id: string): Promise<Booking>;
}

class MockBookingRepository implements BookingRepository {
  private bookings: Booking[] = [];
  private capacities = new Map<string, number>();

  async listBookings() {
    return [...this.bookings].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
  }

  setSessionCapacity(sessionId: string, capacity: number) {
    this.capacities.set(sessionId, capacity);
  }

  async bookSession(sessionId: string, memberId: string, memberName?: string) {
    if (!sessionId || !memberId) {
      throw new Error('Select a member to book.');
    }
    const capacity = this.capacities.get(sessionId) ?? Infinity;
    const activeCount = this.bookings.filter(
      (booking) => booking.sessionId === sessionId && booking.status !== 'cancelled'
    ).length;
    if (activeCount >= capacity) {
      throw new Error('Session is at full capacity.');
    }
    const existing = this.bookings.find(
      (booking) => booking.sessionId === sessionId && booking.memberId === memberId
    );
    if (existing) {
      if (existing.status !== 'cancelled') {
        throw new Error('Member is already booked for this session.');
      }
      const rebooked: Booking = {
        ...existing,
        status: 'booked',
        bookedAt: new Date().toISOString()
      };
      this.bookings = this.bookings.map((booking) => (booking.id === existing.id ? rebooked : booking));
      return rebooked;
    }
    const booking: Booking = {
      id: `booking-${Date.now()}-${this.bookings.length}`,
      sessionId,
      memberId,
      memberName: memberName?.trim() || 'Unknown member',
      status: 'booked',
      bookedAt: new Date().toISOString()
    };
    this.bookings = [...this.bookings, booking];
    return booking;
  }

  async cancelBooking(id: string) {
    const index = this.bookings.findIndex((booking) => booking.id === id);
    if (index === -1) {
      throw new Error('Booking not found.');
    }
    const current = this.bookings[index];
    if (!current) {
      throw new Error('Booking not found.');
    }
    const updated: Booking = { ...current, status: 'cancelled' };
    this.bookings = this.bookings.map((booking) => (booking.id === id ? updated : booking));
    return updated;
  }

  reset() {
    this.bookings = [];
  }
}

export const mockBookingRepository = new MockBookingRepository();