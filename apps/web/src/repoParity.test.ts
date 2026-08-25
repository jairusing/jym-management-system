// A1 (systems-integration review): mock/live repository parity contracts.
//
// The app ships two implementations of every repository — an in-memory mock
// and a Supabase-backed one. Nothing previously forced them to agree. These
// tests pin the SHAPE of returned objects: both implementations must return
// records with the same keys and value types for the same logical query, so
// UI code and unit tests built on the mock cannot drift from production.
//
// Pattern note: extend with additional repositories as needed — build a
// canned PostgREST row, feed it through the fake query chain, then diff
// key-sets against the mock's output.

import { describe, expect, it, vi } from 'vitest';
import { mockMemberRepository } from './features/members/memberRepository';
import { SupabaseMemberRepository } from './features/members/supabaseMemberRepository';
import { mockInvoiceRepository } from './features/payments/invoiceRepository';
import { SupabaseInvoiceRepository } from './features/payments/supabaseInvoiceRepository';

const supabaseConfig = vi.hoisted(() => ({ hasSupabaseConfig: true }));

vi.mock('./lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: { from: vi.fn() }
}));

import { supabase } from './lib/supabase';

const fromMock = vi.mocked(supabase!.from);

/** A plain fake of the supabase-js postgrest builder that resolves to `result`. */
function fakeQuery(result: unknown): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const chain = (): Record<string, unknown> => builder;
  for (const method of ['select', 'eq', 'order', 'gte', 'lte', 'in', 'limit']) {
    builder[method] = chain;
  }
  builder.maybeSingle = () => Promise.resolve({ data: result, error: null });
  builder.single = () => Promise.resolve({ data: result, error: null });
  // Thenable: `await builder` unwraps to the query result.
  builder.then = (onFulfilled: (value: { data: unknown; error: null }) => unknown) => {
    void onFulfilled({ data: result, error: null });
  };
  return builder;
}

function shapeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Asserts both results are arrays whose first elements expose the same
 * key-set and per-key primitive types (objects/arrays compared by key-set).
 */
function expectSameShape(mockResult: unknown[], liveResult: unknown[]): void {
  expect(liveResult.length).toBeGreaterThan(0);
  const mockRecord = mockResult[0] as Record<string, unknown>;
  const liveRecord = liveResult[0] as Record<string, unknown>;
  expect(Object.keys(liveRecord).sort()).toEqual(Object.keys(mockRecord).sort());

  for (const key of Object.keys(mockRecord)) {
    const mockValue = mockRecord[key];
    const liveValue = liveRecord[key];
    if (mockValue !== null && typeof mockValue === 'object') continue;
    expect(`${key}:${shapeOf(liveValue)}`).toBe(`${key}:${shapeOf(mockValue)}`);
  }
}

describe('repository parity (mock vs Supabase shape contracts)', () => {
  it('members.listMembers returns the same shape in both implementations', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Maria Santos',
      email: null,
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    await mockMemberRepository.setMembership((await mockMemberRepository.listMembers())[0]?.id ?? '', {
      planName: 'Monthly Pass',
      startsAt: '2026-08-01',
      endsAt: '2099-08-31',
      status: 'active'
    });
    const mockMembers = await mockMemberRepository.listMembers();

    const cannedRow = {
      id: 'member-1',
      user_id: null,
      full_name: 'Maria Santos',
      email: null,
      phone: null,
      joined_at: '2026-08-01',
      notes: null,
      is_active: true,
      created_at: '2026-08-01T00:00:00+08:00',
      memberships: [
        {
          status: 'active',
          started_at: '2026-08-01',
          ended_at: '2099-08-31',
          created_at: '2026-08-01T00:00:00+08:00',
          membership_plans: [{ name: 'Monthly Pass' }]
        }
      ]
    };
    fromMock.mockReturnValue(fakeQuery([cannedRow]) as never);

    const liveMembers = await new SupabaseMemberRepository().listMembers();
    expectSameShape(mockMembers, liveMembers);
  });

  it('invoices.listInvoices returns the same shape in both implementations', async () => {
    await mockInvoiceRepository.createInvoice({
      memberId: 'member-1',
      memberName: 'Maria Santos',
      total: 1500,
      dueAt: null
    });
    const mockInvoices = await mockInvoiceRepository.listInvoices();

    const cannedRow = {
      id: 'invoice-1',
      invoice_number: 'INV-2026-0001',
      member_id: 'member-1',
      members: [{ full_name: 'Maria Santos' }],
      membership_plans: null,
      total: 1500,
      issued_at: '2026-08-24T00:00:00+08:00',
      due_at: null,
      paid_at: null,
      status: 'issued',
      is_overdue: false,
      plan_id: null,
      created_at: '2026-08-24T00:00:00+08:00'
    };
    fromMock.mockReturnValue(fakeQuery([cannedRow]) as never);

    const liveInvoices = await new SupabaseInvoiceRepository().listInvoices();
    expectSameShape(mockInvoices, liveInvoices);
  });
});
