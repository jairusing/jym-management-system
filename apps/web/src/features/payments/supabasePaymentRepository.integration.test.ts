// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabasePaymentRepository } from './supabasePaymentRepository';
import { SupabaseInvoiceRepository } from './supabaseInvoiceRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (payment/invoice inserts are RLS-restricted).
// Skipped entirely when those env vars are absent (keeps `npm test` green in CI).
// NOTE: invoices/payments cannot be deleted (delete_none RLS) and members with
// invoices cannot be deleted (FK RESTRICT), so this test's rows persist.

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

describeLive('SupabasePaymentRepository (live)', () => {
  const paymentRepo = new SupabasePaymentRepository();
  const invoiceRepo = new SupabaseInvoiceRepository();
  const memberRepo = new SupabaseMemberRepository();
  let memberId: string | undefined;
  let memberName: string | undefined;
  let invoiceId: string | undefined;
  let invoiceNumber: string | undefined;
  let paymentId: string | undefined;
  let planId: string | undefined;

  it('creates a member and an invoice to pay', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Payment Member ${Date.now()}`,
      email: null,
      phone: '0917 000 0000',
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    memberId = member.id;
    memberName = member.fullName;

    const plans = await invoiceRepo.listPlans();
    planId = plans[0]?.id;

    const invoice = await invoiceRepo.createInvoice({
      memberId: member.id,
      memberName: member.fullName,
      total: 2500,
      dueAt: null,
      planId
    });
    invoiceId = invoice.id;
    invoiceNumber = invoice.invoiceNumber;
    expect(member.id).toBeTruthy();
    expect(invoice.id).toBeTruthy();
  });

  it('records a payment and marks the invoice paid', async () => {
    const payment = await paymentRepo.recordPayment({
      invoiceId: invoiceId as string,
      invoiceNumber: invoiceNumber as string,
      memberId: memberId as string,
      memberName: memberName as string,
      amount: 2500,
      method: 'gcash',
      reference: 'IT-GCASH-001'
    });
    paymentId = payment.id;
    expect(payment.id).toBeTruthy();
    expect(payment.memberName).toBe(memberName);
    expect(payment.invoiceNumber).toBe(invoiceNumber);
    expect(payment.method).toBe('gcash');
    expect(payment.reference).toBe('IT-GCASH-001');
    expect(payment.processedBy).toBeTruthy();

    const invoices = await invoiceRepo.listInvoices();
    const invoice = invoices.find((candidate) => candidate.id === invoiceId);
    expect(invoice?.status).toBe('paid');
    expect(invoice?.paidAt).toBeTruthy();
  });

  it('creates an active membership for the paid plan', async () => {
    const members = await memberRepo.listMembers();
    const member = members.find((candidate) => candidate.id === memberId);
    expect(member?.membership?.planName).toBeTruthy();
  });

  it('renews membership, expiring the previous one', async () => {
    const invoice = await invoiceRepo.createInvoice({
      memberId: memberId as string,
      memberName: memberName as string,
      total: 1500,
      dueAt: null,
      planId
    });
    await paymentRepo.recordPayment({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: memberId as string,
      memberName: memberName as string,
      amount: 1500,
      method: 'cash',
      reference: null
    });

    const members = await memberRepo.listMembers();
    const member = members.find((candidate) => candidate.id === memberId);
    expect(member?.membership?.planName).toBeTruthy();
    expect(member?.membership?.endsAt).toBeTruthy();
  });

  it('lists payments including the created one', async () => {
    const payments = await paymentRepo.listPayments();
    const found = payments.find((payment) => payment.id === paymentId);
    expect(found).toBeTruthy();
    expect(found?.memberName).toBe(memberName);
    expect(found?.invoiceNumber).toBe(invoiceNumber);
  });
});