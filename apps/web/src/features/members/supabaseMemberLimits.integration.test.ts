// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabasePaymentRepository } from '../payments/supabasePaymentRepository';
import { SupabaseInvoiceRepository } from '../payments/supabaseInvoiceRepository';
import { SupabaseClassRepository } from '../classes/supabaseClassRepository';
import { SupabaseBookingRepository } from '../classes/supabaseBookingRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test proving the audit-hardening limits for a member-role
// account (migration 012): rpc_record_payment() staff gate, the
// members_update_staff_only policy, and that member booking still works.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD (staff, for setup/cleanup) and
// JYM_MEMBER_EMAIL/JYM_MEMBER_PASSWORD (credentials via JYM_MEMBER_* env vars).
// Skipped entirely when those env vars are absent (keeps `npm test` green in CI).
// NOTE: the member account and its invoice persist (invoices delete_none RLS).

const hasStaff = Boolean(process.env.JYM_TEST_EMAIL && process.env.JYM_TEST_PASSWORD);
const hasMember = Boolean(process.env.JYM_MEMBER_EMAIL && process.env.JYM_MEMBER_PASSWORD);
const describeLive = hasSupabaseConfig && hasStaff && hasMember ? describe : describe.skip;

async function signIn(email: string, password: string) {
  if (!supabase) return;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`signIn as ${email} failed: ${error.message}`);
  }
}

beforeAll(async () => {
  await signIn(process.env.JYM_TEST_EMAIL as string, process.env.JYM_TEST_PASSWORD as string);
});

beforeEach(async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.getUser();
  if (!error) return;
  await signIn(process.env.JYM_TEST_EMAIL as string, process.env.JYM_TEST_PASSWORD as string);
});

afterAll(async () => {
  if (!hasSupabaseConfig || !supabase) return;
  await supabase.auth.signOut();
});

describeLive('Member limits (live)', () => {
  const paymentRepo = new SupabasePaymentRepository();
  const invoiceRepo = new SupabaseInvoiceRepository();
  const classRepo = new SupabaseClassRepository();
  const bookingRepo = new SupabaseBookingRepository();
  let memberId: string | undefined;
  let memberName: string | undefined;
  let invoiceId: string | undefined;
  let invoiceNumber: string | undefined;
  let sessionId: string | undefined;

  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  it('finds the member-account row and issues an invoice as staff', async () => {
    if (!supabase) return;
    const { data: memberData, error: memberError } = await supabase
      .from('members')
      .select('id, full_name')
      .eq('email', process.env.JYM_MEMBER_EMAIL as string)
      .maybeSingle();
    expect(memberError).toBeNull();
    expect(memberData?.id).toBeTruthy();
    memberId = memberData?.id;
    memberName = memberData?.full_name ?? 'Test Member';

    const invoice = await invoiceRepo.createInvoice({
      memberId: memberId as string,
      memberName: memberName as string,
      total: 1000,
      dueAt: null
    });
    invoiceId = invoice.id;
    invoiceNumber = invoice.invoiceNumber;
    expect(invoice.status).toBe('issued');

    const { error: resetError } = await supabase
      .from('members')
      .update({ notes: null })
      .eq('id', memberId as string);
    expect(resetError).toBeNull();
  });

  it('creates a bookable session as staff', async () => {
    const gymClass = await classRepo.createClass({
      name: `IT Member Limits Class ${Date.now()}`,
      capacity: 2,
      dayOfWeek: 5,
      startTime: '16:00',
      endTime: '17:00'
    });
    const session = await classRepo.createSession(gymClass.id, tomorrow);
    sessionId = session.id;
    expect(session.id).toBeTruthy();
  });

  it('rejects payment recording by a member (RPC staff gate)', async () => {
    await signIn(
      process.env.JYM_MEMBER_EMAIL as string,
      process.env.JYM_MEMBER_PASSWORD as string
    );

    await expect(
      paymentRepo.recordPayment({
        invoiceId: invoiceId as string,
        invoiceNumber: invoiceNumber as string,
        memberId: memberId as string,
        memberName: memberName as string,
        amount: 1000,
        method: 'cash',
        reference: null
      })
    ).rejects.toThrow(/Only staff can record payments/);
  });

  it('rejects a member updating their own members row', async () => {
    if (!supabase) return;
    const { data: row, error: selectError } = await supabase
      .from('members')
      .select('id, notes')
      .eq('id', memberId as string)
      .maybeSingle();
    expect(selectError).toBeNull();
    expect(row?.id).toBe(memberId);
    const notesBefore = row?.notes ?? null;

    const { data: updatedRows } = await supabase
      .from('members')
      .update({ notes: 'hacked by member' })
      .eq('id', memberId as string)
      .select('id');
    expect(updatedRows ?? []).toHaveLength(0);

    const { data: after, error: afterError } = await supabase
      .from('members')
      .select('id, notes')
      .eq('id', memberId as string)
      .maybeSingle();
    expect(afterError).toBeNull();
    expect(after?.notes ?? null).toBe(notesBefore);
  });

  it('still lets a member book a session for themselves', async () => {
    const booking = await bookingRepo.bookSession(sessionId as string, memberId as string);
    expect(booking.memberId).toBe(memberId);
    expect(booking.status).toBe('booked');
  });

  it('cleans up the session and class as staff', async () => {
    await signIn(
      process.env.JYM_TEST_EMAIL as string,
      process.env.JYM_TEST_PASSWORD as string
    );
    const classes = await classRepo.listClasses();
    for (const gymClass of classes) {
      if (gymClass.name.startsWith('IT Member Limits Class')) {
        await classRepo.deleteClass(gymClass.id);
      }
    }
    const bookings = await bookingRepo.listBookings();
    expect(bookings.some((booking) => booking.sessionId === sessionId)).toBe(false);
  });
});