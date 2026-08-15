import type { CheckIn } from './checkInRepository';

export function toAttendanceCsv(checkIns: CheckIn[]) {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const rows = checkIns.map((checkIn) =>
    [escape(checkIn.memberName), escape(checkIn.checkedInAt), escape(checkIn.method)].join(',')
  );
  return ['Member,Checked in,Method', ...rows].join('\r\n');
}