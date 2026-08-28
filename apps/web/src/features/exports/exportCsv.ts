import type { CheckIn } from '../checkins/checkInRepository';
import { toCsvTimestamp } from '../../lib/dates';
import type { InvoiceExportRow, MemberExportRow, PaymentExportRow } from './exportRepository';

export function escapeCsvCell(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  return needsQuoting ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(String(cell))).join(','))
    .join('\r\n');
}

export function membersToCsv(members: MemberExportRow[]): string {
  return toCsv(
    ['Member ID', 'Full name', 'Email', 'Phone', 'Joined', 'Active', 'Plan', 'Membership status', 'Membership ends'],
    members.map((member) => [
      member.memberId,
      member.fullName,
      member.email ?? '',
      member.phone ?? '',
      member.joinedAt.slice(0, 10),
      member.isActive ? 'yes' : 'no',
      member.planName ?? '',
      member.membershipStatus ?? '',
      member.membershipEndsAt?.slice(0, 10) ?? ''
    ])
  );
}

export function invoicesToCsv(invoices: InvoiceExportRow[]): string {
  return toCsv(
    ['Invoice number', 'Member', 'Total (PHP)', 'Status', 'Issued', 'Due', 'Paid'],
    invoices.map((invoice) => [
      invoice.invoiceNumber,
      invoice.memberName,
      String(invoice.total),
      invoice.status,
      invoice.issuedAt.slice(0, 10),
      invoice.dueAt?.slice(0, 10) ?? '',
      invoice.paidAt?.slice(0, 10) ?? ''
    ])
  );
}

export function paymentsToCsv(payments: PaymentExportRow[]): string {
  return toCsv(
    ['Invoice number', 'Member', 'Amount (PHP)', 'Method', 'Reference', 'Paid (Manila time)', 'Taken by'],
    payments.map((payment) => [
      payment.invoiceNumber ?? '',
      payment.memberName,
      String(payment.amount),
      payment.method,
      payment.reference ?? '',
      toCsvTimestamp(payment.paidAt),
      payment.processedBy ?? ''
    ])
  );
}

export function checkInsToCsv(checkIns: CheckIn[]): string {
  return toCsv(
    ['Member', 'Checked in (Manila time)', 'Method'],
    checkIns.map((checkIn) => [checkIn.memberName, toCsvTimestamp(checkIn.checkedInAt), checkIn.method])
  );
}