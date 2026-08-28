import { describe, expect, it } from 'vitest';
import { checkInsToCsv, escapeCsvCell, invoicesToCsv, membersToCsv, paymentsToCsv, toCsv } from './exportCsv';
import type { InvoiceExportRow, MemberExportRow, PaymentExportRow } from './exportRepository';

const member: MemberExportRow = {
  memberId: 'member-1',
  fullName: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: null,
  joinedAt: '2026-01-01T00:00:00.000Z',
  isActive: true,
  planName: 'Monthly Pass',
  membershipStatus: 'active',
  membershipEndsAt: '2026-08-31'
};

const invoice: InvoiceExportRow = {
  invoiceNumber: 'INV-1001',
  memberName: 'Juan Dela Cruz',
  total: 1500,
  status: 'paid',
  issuedAt: '2026-08-01T02:00:00.000Z',
  dueAt: null,
  paidAt: '2026-08-16T02:00:00.000Z'
};

const payment: PaymentExportRow = {
  invoiceNumber: 'INV-1001',
  memberName: 'Juan Dela Cruz',
  amount: 1500,
  method: 'gcash',
  reference: 'G-12345',
  paidAt: '2026-08-16T10:00:00.000Z',
  processedBy: 'Front desk'
};

describe('exportCsv', () => {
  it('escapes commas, quotes and newlines inside cells', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
  });

  it('joins a header and rows with CRLF line endings', () => {
    expect(toCsv(['Name', 'Score'], [['Ana', '1']])).toBe('Name,Score\r\nAna,1');
  });

  it('serializes members with day-precision dates and active flag', () => {
    const csv = membersToCsv([member]);
    expect(csv).toContain('Member ID,Full name,Email,Phone,Joined,Active');
    expect(csv).toContain('Juan Dela Cruz');
    expect(csv).toContain('juan@example.com');
    expect(csv).toContain('2026-01-01');
    expect(csv).toContain('2026-08-31');
    expect(csv).toContain(',yes,Monthly Pass,active,');
  });

  it('serializes invoices with totals and day-precision dates', () => {
    const csv = invoicesToCsv([invoice]);
    expect(csv).toContain('INV-1001');
    expect(csv).toContain('1500');
    expect(csv).toContain(',paid,2026-08-01,,2026-08-16');
  });

  it('serializes payments with Manila timestamps', () => {
    const csv = paymentsToCsv([payment]);
    expect(csv).toContain('G-12345');
    expect(csv).toContain('2026-08-16 18:00:00');
    expect(csv).toContain('Front desk');
  });

  it('serializes check-ins with Manila timestamps', () => {
    const csv = checkInsToCsv([
      { id: 'ci-1', memberId: 'member-1', memberName: 'Juan Dela Cruz', checkedInAt: '2026-08-16T10:00:00.000Z', method: 'qr', processedBy: null }
    ]);
    expect(csv).toContain('Juan Dela Cruz');
    expect(csv).toContain('2026-08-16 18:00:00');
    expect(csv).toContain(',qr');
  });
});