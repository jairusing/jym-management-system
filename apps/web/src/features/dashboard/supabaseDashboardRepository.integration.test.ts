// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseDashboardRepository } from './supabaseDashboardRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';
import { SupabaseCheckInRepository } from '../checkins/supabaseCheckInRepository';
import { SupabaseInvoiceRepository } from '../payments/supabaseInvoiceRepository';
import { SupabasePaymentRepository } from '../payments/supabasePaymentRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (inserts are RLS-restricted).
// Skipped entirely when those env vars are absent (keeps `npm test` green in CI).
// Assertions are >= comparisons because the live DB may already hold rows.
// NOTE: the invoice/payment member persists (invoices delete_none + FK RESTRICT).

const hasTestUser = Boolean(process.env.JYM_TEST_EMAIL && process.env.JYM_TEST_PASSWORD);
const describeLive = hasSupabaseConfig && hasTestUser ? describe : describe.skip;

beforeAll(async () => {
  if (!hasSupabaseConfig || !hasTestUser || !supabase) return;

  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (error) {
    throw new Error(`signIn with JYM_TEST_EMAIL failed: ${error.message}`);
  }
});

beforeEach(async () => {
  if (!supabase) return;

  const { error } = await supabase.auth.getUser();
  if (!error) return;

  await supabase.auth.signOut();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (signInError) {
    throw new Error(`re-signIn with JYM_TEST_EMAIL failed: ${signInError.message}`);
  }
});

afterAll(async () => {
  if (!hasSupabaseConfig || !supabase) return;
  await supabase.auth.signOut();
});

describeLive('SupabaseDashboardRepository (live)', () => {
  const dashboardRepo = new SupabaseDashboardRepository();
  const memberRepo = new SupabaseMemberRepository();
  const checkInRepo = new SupabaseCheckInRepository();
  const invoiceRepo = new SupabaseInvoiceRepository();
  const paymentRepo = new SupabasePaymentRepository();
  let checkInMemberId: string | undefined;

  it('reflects a fresh check-in in attendance', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Dashboard Member ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    checkInMemberId = member.id;

    await checkInRepo.recordCheckIn({ memberId: member.id, memberName: member.fullName });

    const before = await dashboardRepo.getDashboard();
    expect(before.stats.attendanceToday).toBeGreaterThanOrEqual(1);
    expect(before.stats.attendanceWeek).toBeGreaterThanOrEqual(1);
    expect(before.stats.activeMembers).toBeGreaterThanOrEqual(1);
  });

  it('reflects a payment and invoice in revenue', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Dashboard Pay Member ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    const invoice = await invoiceRepo.createInvoice({
      memberId: member.id,
      memberName: member.fullName,
      total: 2000,
      dueAt: null
    });
    await paymentRepo.recordPayment({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: member.id,
      memberName: member.fullName,
      amount: 2000,
      method: 'cash',
      reference: 'IT-DASH-001'
    });

    const view = await dashboardRepo.getDashboard();
    expect(view.stats.revenueMonth).toBeGreaterThanOrEqual(2000);
    expect(view.stats.revenueTotal).toBeGreaterThanOrEqual(2000);
  });

  it('cleans up the check-in member (cascades its check-in)', async () => {
    await memberRepo.deleteMember(checkInMemberId as string);
    const view = await dashboardRepo.getDashboard();
    expect(view.stats.activeMembers).toBeGreaterThanOrEqual(0);
    expect(view.weeklyAttendance.length).toBe(7);
  });
});