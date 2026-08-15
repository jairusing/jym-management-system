import { describe, expect, it } from 'vitest';
import { toAttendanceCsv } from './attendanceCsv';
import type { CheckIn } from './checkInRepository';

describe('toAttendanceCsv', () => {
  it('emits a header row and one row per check-in', () => {
    const checkIns: CheckIn[] = [
      {
        id: '1',
        memberId: 'm1',
        memberName: 'Juan Dela Cruz',
        checkedInAt: '2026-08-16T06:30:45.000Z',
        method: 'manual',
        processedBy: null
      },
      {
        id: '2',
        memberId: 'm2',
        memberName: 'Maria "Mai" Santos',
        checkedInAt: '2026-08-16T07:00:00.000Z',
        method: 'qr',
        processedBy: null
      }
    ];

    const csv = toAttendanceCsv(checkIns);

    expect(csv).toBe(
      'Member,Checked in,Method\r\n' +
        '"Juan Dela Cruz","2026-08-16 14:30:45","manual"\r\n' +
        '"Maria ""Mai"" Santos","2026-08-16 15:00:00","qr"'
    );
  });

  it('emits only the header when there are no check-ins', () => {
    expect(toAttendanceCsv([])).toBe('Member,Checked in,Method');
  });
});