// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseInvoiceRepository } from '../payments/supabaseInvoiceRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';
import { SupabaseStaffRepository } from '../staff/supabaseStaffRepository';
import { SupabaseAuditRepository } from './supabaseAuditRepository';
import { SupabasePaymentRepository } from '../payments/supabasePaymentRepository';
import { SupabaseBookingRepository } from '../classes/supabaseBookingRepository';
import { SupabaseClassRepository } from '../classes/supabaseClassRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test proving E2 (migration 022 triggers make void + deactivate
// owner-only, enforced server-side) and D3 (destructive actions land in
// audit_log with actor, target, and time).
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD (owner) and
// JYM_MEMBER_EMAIL/JYM_MEMBER_PASSWORD (account temporarily promoted to staff
// during the test, then reverted). Skipped when env vars are absent.
// NOTE: the invoice and audit rows created here persist in the live DB
// (delete_none RLS / no delete path) — same convention as the invoice test.

const hasTestUser = Boolean(
  process.env.JYM_TEST_EMAIL &&
    process.env.JYM_TEST_PASSWORD &&
    process.env.JYM_MEMBER_EMAIL &&
    process.env.JYM_MEMBER_PASSWORD
);
const describeLive = hasSupabaseConfig && hasTestUser ? describe : describe.skip;

let memberProfileId: string | undefined;

async function signInAsOwner() {
  if (!supabase) return;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (error) {
    throw new Error(`signIn as owner failed: ${error.message}`);
  }
}

async function signInAsMember() {
  if (!supabase) return;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_MEMBER_EMAIL as string,
    password: process.env.JYM_MEMBER_PASSWORD as string
  });
  if (error) {
    throw new Error(`signIn as member failed: ${error.message}`);
  }
}

async function demoteMemberAccount() {
  if (!memberProfileId) return;
  const staffRepo = new SupabaseStaffRepository();
  await staffRepo.updateRole(memberProfileId, 'member').catch(() => undefined);
}

beforeAll(async () => {
  if (!hasSupabaseConfig || !hasTestUser || !supabase) return;
  await signInAsOwner();
});

afterAll(async () => {
  if (!hasSupabaseConfig || !hasTestUser || !supabase) return;
  await signInAsOwner();
  await demoteMemberAccount();
  await supabase.auth.signOut();
});

describeLive('Owner-only enforcement + audit log (live)', () => {
  const invoiceRepo = new SupabaseInvoiceRepository();
  const memberRepo = new SupabaseMemberRepository();
  const staffRepo = new SupabaseStaffRepository();
  const auditRepo = new SupabaseAuditRepository();
  let memberId: string | undefined;
  let memberName: string | undefined;
  let invoiceId: string | undefined;

  it('creates a member and an invoice as owner', async () => {
    await signInAsOwner();
    const member = await memberRepo.createMember({
      fullName: `IT OwnerOnly Member ${Date.now()}`,
      email: null,
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    memberId = member.id;
    memberName = member.fullName;

    const invoice = await invoiceRepo.createInvoice({
      memberId: member.id,
      memberName: member.fullName,
      total: 1200,
      dueAt: null
    });
    invoiceId = invoice.id;
    expect(invoice.status).toBe('issued');
  });

  it('promotes the member account to staff', async () => {
    await signInAsOwner();
    const profiles = await staffRepo.listProfiles();
    const profile = profiles.find((candidate) => candidate.email === process.env.JYM_MEMBER_EMAIL);
    expect(profile).toBeTruthy();
    memberProfileId = profile?.id;
    await staffRepo.updateRole(profile?.id as string, 'staff');

    const after = await staffRepo.listProfiles();
    expect(after.find((candidate) => candidate.id === memberProfileId)?.role).toBe('staff');
  });

  it('rejects voiding an invoice as staff (server-enforced)', async () => {
    await signInAsMember();
    await expect(invoiceRepo.voidInvoice(invoiceId as string)).rejects.toThrow(
      /only the owner can void/i
    );
  });

  it('rejects deactivating a member as staff (server-enforced)', async () => {
    await signInAsMember();
    await expect(memberRepo.setMemberActive(memberId as string, false)).rejects.toThrow(
      /only the owner can deactivate/i
    );
  });

  it('allows the owner to deactivate and reactivate', async () => {
    await signInAsOwner();
    const deactivated = await memberRepo.setMemberActive(memberId as string, false);
    expect(deactivated.isActive).toBe(false);
    const reactivated = await memberRepo.setMemberActive(memberId as string, true);
    expect(reactivated.isActive).toBe(true);
  });

  it('records a void action in the audit log with actor and time', async () => {
    await signInAsOwner();
    await invoiceRepo.voidInvoice(invoiceId as string);

    const entries = await auditRepo.listAuditEntries();
    const entry = entries.find(
      (candidate) => candidate.action === 'void' && candidate.targetId === invoiceId
    );
    expect(entry).toBeTruthy();
    expect(entry?.performedByName).toBeTruthy();
    expect(entry?.createdAt).toBeTruthy();
  });

  it('demotes the member account back to member', async () => {
    await signInAsOwner();
    await demoteMemberAccount();
    const after = await staffRepo.listProfiles();
    expect(after.find((candidate) => candidate.id === memberProfileId)?.role).toBe('member');
    expect(memberName).toBeTruthy();
  });

  it('records a payment in the audit log', async () => {
    await signInAsOwner();
    const paymentRepo = new SupabasePaymentRepository();
    const payment = await paymentRepo.recordPayment({
      invoiceId: invoiceId as string,
      memberId: memberId as string,
      amount: 1200,
      method: 'cash',
      reference: null
    });

    const entries = await auditRepo.listAuditEntries();
    const entry = entries.find(
      (candidate) => candidate.action === 'payment' && candidate.targetId === payment.id
    );
    expect(entry).toBeTruthy();
    expect(entry?.performedByName).toBeTruthy();
  });

  it('records a booking in the audit log', async () => {
    await signInAsOwner();
    const classRepo = new SupabaseClassRepository();
    const bookingRepo = new SupabaseBookingRepository();
    const classes = await classRepo.listClasses();
    const activeClass = classes.find((c) => c.isActive);
    expect(activeClass).toBeTruthy();

    const booking = await bookingRepo.bookSession(
      activeClass!.id,
      memberId as string
    );

    const entries = await auditRepo.listAuditEntries();
    const entry = entries.find(
      (candidate) => candidate.action === 'book' && candidate.targetId === booking.id
    );
    expect(entry).toBeTruthy();
  });
});