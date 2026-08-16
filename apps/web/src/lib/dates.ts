export const PH_TIME_ZONE = 'Asia/Manila';

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(`${date.slice(0, 10)}T00:00:00`)
  );
}

export function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(date));
}

export function formatWhen(date: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PH_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date(date));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  return hour === '00' && minute === '00' ? formatDate(date) : formatDateTime(date);
}

export function phDateOf(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

export function phDateToday() {
  return phDateOf(new Date());
}

export function phDateInDays(days: number) {
  return phDateOf(new Date(Date.now() + days * 86400000));
}

export function phDateAfter(dateStr: string, days: number) {
  return phDateOf(new Date(new Date(`${dateStr.slice(0, 10)}T00:00:00+08:00`).getTime() + days * 86400000));
}

export function phDayStartUtc(dateStr: string) {
  return new Date(`${dateStr}T00:00:00+08:00`).toISOString();
}

export function phDayEndUtc(dateStr: string) {
  return new Date(`${dateStr}T23:59:59.999+08:00`).toISOString();
}

export function toCsvTimestamp(date: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date(date));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}