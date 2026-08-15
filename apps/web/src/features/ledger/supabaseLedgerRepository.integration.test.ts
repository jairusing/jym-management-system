// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseLedgerRepository } from './supabaseLedgerRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';
import { SupabaseInvoiceRepository } from '../payments/supabaseInvoiceRepository';
import { SupabasePaymentRepository } from '../payments/supabasePaymentRepository';

declare const process: { env: Record<string, string | undefined> };

// Live test proving the member statement aggregate (memberships history +
// invoices + payments + outstanding) against the real project. Requires
// JYM_TEST_EMAIL/JYM_TEST_PASSWORD (owner). The member/invoice/payment rows
// persist (invoices delete_none RLS + FK RESTRICT), so none are deleted.

const hasTestUser = Boolean(process.env.JYM_TEST_EMAIL && process.env.JYM_TEST_PASSWORD);
const describeLive = hasSupabaseConfig && hasTestUser ? describe : describe.skip;

async function signIn() {
  if (!supabase) return;
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.JYM_TEST_EMAIL as string,
    password: process.env.JYM_TEST_PASSWORD as string
  });
  if (error) {
    throw new Error(`signIn failed: ${error.message}`);
  }
}

beforeAll(signIn);

beforeEach(async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.getUser();
  if (!error) return;
  await signIn();
});

afterAll(async () => {
  if (!hasSupabaseConfig || !supabase) return;
  await supabase.auth.signOut();
});

describeLive('Ledger statement (live)', () => {
  const ledgerRepo = new SupabaseLedgerRepository();
  const memberRepo = new SupabaseMemberRepository();
  const invoiceRepo = new SupabaseInvoiceRepository();
  const paymentRepo = new SupabasePaymentRepository();

  it('returns a complete statement after a payment renews a membership', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Ledger Member ${Date.now()}`,
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });

    const plans = await invoiceRepo.listPlans();
    const plan = plans[0];
    expect(plan).toBeTruthy();

    const invoice = await invoiceRepo.createInvoice({
      memberId: member.id,
      memberName: member.fullName,
      total: plan?.price ?? 1500,
      dueAt: null,
      planId: plan?.id
    });

    await paymentRepo.recordPayment({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      memberId: member.id,
      memberName: member.fullName,
      amount: plan?.price ?? 1500,
      method: 'gcash',
      reference: `IT-ledger-${Date.now()}`
    });

    const statement = await ledgerRepo.getMemberStatement(member.id);
    expect(statement.member.id).toBe(member.id);
    expect(statement.invoices.some((entry) => entry.id === invoice.id)).toBe(true);
    expect(statement.payments.some((entry) => entry.invoiceId === invoice.id)).toBe(true);
    expect(statement.memberships.length).toBeGreaterThanOrEqual(1);
    expect(statement.memberships[0]?.status).toBe('active');
    expect(statement.outstanding).toBe(0);
  });

  it('reports the outstanding balance for unpaid invoices', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Ledger Member ${Date.now()}`,
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });

    await invoiceRepo.createInvoice({
      memberId: member.id,
      memberName: member.fullName,
      total: 2500,
      dueAt: null
    });

    const statement = await ledgerRepo.getMemberStatement(member.id);
    expect(statement.outstanding).toBe(2500);
  });
});