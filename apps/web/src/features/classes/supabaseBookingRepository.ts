import { supabase } from '../../lib/supabase';
import { type Booking } from './bookingRepository';

function ensureSupabase() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.');
  }
  return supabase;
}

type BookingRow = {
  id: string;
  session_id: string;
  member_id: string;
  status: 'booked' | 'cancelled' | 'attended' | 'no_show';
  booked_at: string;
  members: { full_name: string } | { full_name: string }[] | null;
};

const bookingColumns = 'id, session_id, member_id, status, booked_at, members(full_name)';

function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    sessionId: row.session_id,
    memberId: row.member_id,
    memberName: (Array.isArray(row.members) ? row.members[0] : row.members)?.full_name ?? 'Unknown member',
    status: row.status,
    bookedAt: row.booked_at
  };
}

export class SupabaseBookingRepository {
  async listBookings(): Promise<Booking[]> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('class_bookings')
      .select(bookingColumns)
      .order('booked_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to load bookings: ${error.message}`);
    }

    return (data ?? []).map((row) => mapBooking(row as BookingRow));
  }

  async bookSession(sessionId: string, memberId: string): Promise<Booking> {
    const client = ensureSupabase();

    if (!sessionId || !memberId) {
      throw new Error('Select a member to book.');
    }

    const { data: session, error: sessionError } = await client
      .from('class_sessions')
      .select('capacity')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      throw new Error(`Failed to load session: ${sessionError?.message ?? 'not found'}`);
    }

    const { count, error: countError } = await client
      .from('class_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .neq('status', 'cancelled');

    if (countError) {
      throw new Error(`Failed to count bookings: ${countError.message}`);
    }

    if ((count ?? 0) >= session.capacity) {
      throw new Error('Session is at full capacity.');
    }

    const { data: existing, error: existingError } = await client
      .from('class_bookings')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('member_id', memberId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Failed to check existing booking: ${existingError.message}`);
    }

    if (existing) {
      if (existing.status !== 'cancelled') {
        throw new Error('Member is already booked for this session.');
      }
      const { data: rebooked, error: rebookError } = await client
        .from('class_bookings')
        .update({ status: 'booked', booked_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select(bookingColumns)
        .single();
      if (rebookError || !rebooked) {
        throw new Error(`Failed to book session: ${rebookError?.message ?? 'unknown'}`);
      }
      return mapBooking(rebooked as BookingRow);
    }

    const { data, error } = await client
      .from('class_bookings')
      .insert({ session_id: sessionId, member_id: memberId })
      .select(bookingColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to book session: ${error?.message ?? 'unknown'}`);
    }

    return mapBooking(data as BookingRow);
  }

  async cancelBooking(id: string): Promise<Booking> {
    const client = ensureSupabase();

    const { data, error } = await client
      .from('class_bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select(bookingColumns)
      .single();

    if (error || !data) {
      throw new Error(`Failed to cancel booking: ${error?.message ?? 'unknown'}`);
    }

    return mapBooking(data as BookingRow);
  }
}