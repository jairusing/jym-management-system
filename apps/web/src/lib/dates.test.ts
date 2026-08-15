import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  phDateInDays,
  phDateOf,
  phDateToday,
  phDayEndUtc,
  phDayStartUtc,
  toCsvTimestamp
} from './dates';

describe('formatDateTime', () => {
  it('renders exact Manila time with seconds from a UTC instant', () => {
    expect(formatDateTime('2026-08-16T10:00:00.000Z')).toBe('Aug 16, 2026, 6:00:00 PM');
    expect(formatDateTime('2026-08-16T16:30:45.000Z')).toBe('Aug 17, 2026, 12:30:45 AM');
  });
});

describe('formatDate', () => {
  it('renders a calendar date independent of timezone', () => {
    expect(formatDate('2026-08-16')).toBe('Aug 16, 2026');
  });
});

describe('phDate helpers', () => {
  it('returns YYYY-MM-DD for today and offsets', () => {
    expect(phDateToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(phDateInDays(30)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('converts an arbitrary instant to the Manila calendar date', () => {
    expect(phDateOf(new Date('2026-08-15T16:30:00.000Z'))).toBe('2026-08-16');
    expect(phDateOf(new Date('2026-08-16T15:59:59.000Z'))).toBe('2026-08-16');
    expect(phDateOf(new Date('2026-08-16T16:00:00.000Z'))).toBe('2026-08-17');
  });

  it('converts a Manila calendar day to UTC boundaries', () => {
    expect(phDayStartUtc('2026-08-16')).toBe('2026-08-15T16:00:00.000Z');
    expect(phDayEndUtc('2026-08-16')).toBe('2026-08-16T15:59:59.999Z');
  });

  it('converts a UTC instant to a Manila CSV timestamp', () => {
    expect(toCsvTimestamp('2026-08-16T10:00:00.000Z')).toBe('2026-08-16 18:00:00');
  });
});