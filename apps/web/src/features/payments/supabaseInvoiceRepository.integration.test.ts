// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { supabase, hasSupabaseConfig } from '../../lib/supabase';
import { SupabaseInvoiceRepository } from './supabaseInvoiceRepository';
import { SupabaseMemberRepository } from '../members/supabaseMemberRepository';

declare const process: { env: Record<string, string | undefined> };

// Live integration test against the linked jym-management-system project.
// Requires JYM_TEST_EMAIL/JYM_TEST_PASSWORD set to a CONFIRMED account whose
// profile role is 'owner' or 'staff' (invoice inserts are RLS-restricted).
// Skipped entirely when those env vars are absent (keeps `npm test` green in CI).
// NOTE: invoices cannot be deleted (delete_none RLS) and members with invoices
// cannot be deleted (FK RESTRICT), so this test's rows persist in the live DB.

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

describeLive('SupabaseInvoiceRepository (live)', () => {
  const invoiceRepo = new SupabaseInvoiceRepository();
  const memberRepo = new SupabaseMemberRepository();
  let memberId: string | undefined;
  let memberName: string | undefined;
  let invoiceId: string | undefined;
  let invoiceNumber: string | undefined;

  it('creates a member to invoice', async () => {
    const member = await memberRepo.createMember({
      fullName: `IT Invoice Member ${Date.now()}`,
      email: null,
      phone: `0917 ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      joinedAt: '2026-08-16',
      notes: 'integration test'
    });
    memberId = member.id;
    memberName = member.fullName;
    expect(member.id).toBeTruthy();
  });

  it('creates an invoice for the member', async () => {
    const plans = await invoiceRepo.listPlans();
    expect(plans.length).toBeGreaterThan(0);

    const invoice = await invoiceRepo.createInvoice({
      memberId: memberId as string,
      memberName: memberName as string,
      total: 1500,
      dueAt: '2026-09-15',
      planId: plans[0]?.id
    });
    invoiceId = invoice.id;
    invoiceNumber = invoice.invoiceNumber;
    expect(invoice.id).toBeTruthy();
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(invoice.total).toBe(1500);
    expect(invoice.status).toBe('issued');
    expect(invoice.memberName).toBe(memberName);
    expect(invoice.planId).toBe(plans[0]?.id);
    expect(invoice.planName).toBe(plans[0]?.name);
  });

  it('lists invoices including the created one with member name and plan', async () => {
    const invoices = await invoiceRepo.listInvoices();
    const found = invoices.find((invoice) => invoice.id === invoiceId);
    expect(found).toBeTruthy();
    expect(found?.memberName).toBe(memberName);
    expect(found?.invoiceNumber).toBe(invoiceNumber);
    expect(found?.planName).toBeTruthy();
  });

  it('marks an unpaid invoice as overdue when its due date has passed', async () => {
    const invoice = await invoiceRepo.createInvoice({
      memberId: memberId as string,
      memberName: memberName as string,
      total: 900,
      dueAt: '2020-01-01'
    });
    const found = (await invoiceRepo.listInvoices()).find((candidate) => candidate.id === invoice.id);
    expect(found?.status).toBe('overdue');
    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(invoice.invoiceNumber).not.toBe(invoiceNumber);
  });

  it('voids an issued invoice', async () => {
    const invoice = await invoiceRepo.createInvoice({
      memberId: memberId as string,
      memberName: memberName as string,
      total: 700,
      dueAt: null
    });
    const voided = await invoiceRepo.voidInvoice(invoice.id);
    expect(voided.status).toBe('void');
  });
});