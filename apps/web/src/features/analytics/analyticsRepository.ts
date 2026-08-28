import { phDateAfter, phDateInDays, phDateOf, phDateToday } from '../../lib/dates';

export type AnalyticsWindow = 30 | 90 | 365;

export type AnalyticsRawCheckIn = { memberId: string; checkedInAt: string };
export type AnalyticsRawMembership = { memberId: string; startedAt: string; endedAt: string | null; status: string };
export type AnalyticsRawMember = { id: string; fullName: string };
export type AnalyticsRawPayment = { memberId: string; amount: number; paidAt: string };

export type AnalyticsInput = {
  checkIns: AnalyticsRawCheckIn[];
  memberships: AnalyticsRawMembership[];
  members: AnalyticsRawMember[];
  payments: AnalyticsRawPayment[];
};

export type AnalyticsTimeframe = { windowDays: AnalyticsWindow; fromDate: string; toDate: string };

export type PeakDay = { date: string; count: number };

export type AnalyticsSnapshot = AnalyticsTimeframe & {
  totalCheckIns: number;
  uniqueVisitors: number;
  dailyAverage: number;
  peakDay: PeakDay | null;
  memberPool: number;
  attendanceRate: number | null;
  activeAtStart: number;
  stillActive: number;
  retentionRate: number | null;
  expiredThisWindow: number;
  renewedThisWindow: number;
  churnedThisWindow: number;
  churnRate: number | null;
  totalCollected: number;
  topMembers: { memberId: string; memberName: string; totalPaid: number; checkIns: number }[];
};

export interface AnalyticsRepository {
  getAnalytics(windowDays: AnalyticsWindow): Promise<AnalyticsSnapshot>;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildTimeframe(windowDays: AnalyticsWindow, today = phDateToday()): AnalyticsTimeframe {
  return {
    windowDays,
    fromDate: phDateAfter(today, -(windowDays - 1)),
    toDate: today
  };
}

// Pure, timezone-aware aggregator shared by the mock and Supabase repo so the
// demo and the live app compute identical numbers.
export function computeAnalytics(
  input: AnalyticsInput,
  windowDays: AnalyticsWindow,
  today = phDateToday()
): AnalyticsSnapshot {
  const timeframe = buildTimeframe(windowDays, today);
  const { fromDate, toDate } = timeframe;

  const dateInWindow = (iso: string) => {
    const date = phDateOf(new Date(iso));
    return date >= fromDate && date <= toDate;
  };

  const checkInsInWindow = input.checkIns.filter((checkIn) => dateInWindow(checkIn.checkedInAt));
  const visitors = new Set(checkInsInWindow.map((checkIn) => checkIn.memberId));

  const totalCheckIns = checkInsInWindow.length;
  const uniqueVisitors = visitors.size;
  const dailyAverage = round1(totalCheckIns / windowDays);

  const dayCounts = new Map<string, number>();
  for (const checkIn of checkInsInWindow) {
    const date = phDateOf(new Date(checkIn.checkedInAt));
    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1);
  }
  let peakDay: PeakDay | null = null;
  for (const [date, count] of dayCounts) {
    if (!peakDay || count > peakDay.count || (count === peakDay.count && date < peakDay.date)) {
      peakDay = { date, count };
    }
  }

  const memberPool = new Set<string>();
  for (const membership of input.memberships) {
    const overlaps = membership.startedAt <= toDate && (membership.endedAt === null || membership.endedAt >= fromDate);
    if (overlaps) {
      memberPool.add(membership.memberId);
    }
  }
  for (const memberId of visitors) {
    memberPool.add(memberId);
  }
  const attendanceRate = memberPool.size > 0 ? round1((uniqueVisitors / memberPool.size) * 100) : null;

  const activeToday = new Set<string>();
  for (const membership of input.memberships) {
    if (membership.status === 'active' && (membership.endedAt === null || membership.endedAt >= toDate)) {
      activeToday.add(membership.memberId);
    }
  }

  const activeAtStartSet = new Set<string>();
  for (const membership of input.memberships) {
    const coversStart = membership.startedAt <= fromDate && (membership.endedAt === null || membership.endedAt >= fromDate);
    if (coversStart) {
      activeAtStartSet.add(membership.memberId);
    }
  }
  const activeAtStart = activeAtStartSet.size;
  let stillActive = 0;
  for (const memberId of activeAtStartSet) {
    if (activeToday.has(memberId)) {
      stillActive += 1;
    }
  }
  const retentionRate = activeAtStart > 0 ? round1((stillActive / activeAtStart) * 100) : null;

  const endedInWindow = input.memberships.filter(
    (membership) => membership.endedAt !== null && membership.endedAt >= fromDate && membership.endedAt <= toDate
  );
  const expiredThisWindow = endedInWindow.length;
  const renewed = new Set(endedInWindow.map((membership) => membership.memberId));
  let renewedThisWindow = 0;
  for (const memberId of renewed) {
    if (activeToday.has(memberId)) {
      renewedThisWindow += 1;
    }
  }
  const churnedThisWindow = Math.max(0, expiredThisWindow - renewedThisWindow);
  const churnRate = expiredThisWindow > 0 ? round1((churnedThisWindow / expiredThisWindow) * 100) : null;

  const paymentsInWindow = input.payments.filter((payment) => dateInWindow(payment.paidAt));
  const totalCollected = round2(paymentsInWindow.reduce((sum, payment) => sum + payment.amount, 0));

  const nameById = new Map(input.members.map((member) => [member.id, member.fullName]));
  const totalByMember = new Map<string, number>();
  for (const payment of paymentsInWindow) {
    totalByMember.set(payment.memberId, (totalByMember.get(payment.memberId) ?? 0) + payment.amount);
  }
  const visitCounts = new Map<string, number>();
  for (const checkIn of checkInsInWindow) {
    visitCounts.set(checkIn.memberId, (visitCounts.get(checkIn.memberId) ?? 0) + 1);
  }
  const topMembers = [...totalByMember.entries()]
    .map(([memberId, totalPaid]) => ({
      memberId,
      memberName: nameById.get(memberId) ?? 'Unknown member',
      totalPaid: round2(totalPaid),
      checkIns: visitCounts.get(memberId) ?? 0
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid || a.memberName.localeCompare(b.memberName))
    .slice(0, 10);

  return {
    ...timeframe,
    totalCheckIns,
    uniqueVisitors,
    dailyAverage,
    peakDay,
    memberPool: memberPool.size,
    attendanceRate,
    activeAtStart,
    stillActive,
    retentionRate,
    expiredThisWindow,
    renewedThisWindow,
    churnedThisWindow,
    churnRate,
    totalCollected,
    topMembers
  };
}

const EMPTY_INPUT: AnalyticsInput = { checkIns: [], memberships: [], members: [], payments: [] };

function demoInput(): AnalyticsInput {
  const visit = (daysAgo: number, hour: number) => {
    const date = phDateInDays(-daysAgo);
    return new Date(`${date}T${String(hour).padStart(2, '0')}:30:00+08:00`).toISOString();
  };

  const checkIns: AnalyticsRawCheckIn[] = [];
  for (let day = 0; day < 14; day += 1) {
    checkIns.push({ memberId: 'm1', checkedInAt: visit(day, 8) });
    if (day % 2 === 0) {
      checkIns.push({ memberId: 'm2', checkedInAt: visit(day, 17) });
    }
    if (day % 3 === 0) {
      checkIns.push({ memberId: 'm3', checkedInAt: visit(day, 10) });
    }
    if (day % 7 === 0) {
      checkIns.push({ memberId: 'm4', checkedInAt: visit(day, 19) });
    }
  }

  return {
    checkIns,
    memberships: [
      { memberId: 'm1', startedAt: phDateInDays(-60), endedAt: phDateInDays(30), status: 'active' },
      { memberId: 'm2', startedAt: phDateInDays(-90), endedAt: phDateInDays(10), status: 'active' },
      { memberId: 'm3', startedAt: phDateInDays(-31), endedAt: phDateInDays(-1), status: 'expired' },
      { memberId: 'm4', startedAt: phDateInDays(-40), endedAt: phDateInDays(60), status: 'active' }
    ],
    members: [
      { id: 'm1', fullName: 'Juan Dela Cruz' },
      { id: 'm2', fullName: 'Maria Santos' },
      { id: 'm3', fullName: 'Pedro Reyes' },
      { id: 'm4', fullName: 'Ana Lim' }
    ],
    payments: [
      { memberId: 'm1', amount: 1500, paidAt: visit(3, 9) },
      { memberId: 'm2', amount: 1500, paidAt: visit(6, 9) },
      { memberId: 'm1', amount: 4500, paidAt: visit(10, 9) },
      { memberId: 'm4', amount: 1500, paidAt: visit(12, 9) }
    ]
  };
}

class MockAnalyticsRepository implements AnalyticsRepository {
  private input: AnalyticsInput = demoInput();

  async getAnalytics(windowDays: AnalyticsWindow) {
    return computeAnalytics(this.input, windowDays);
  }

  setInput(input: AnalyticsInput | null) {
    this.input = input ?? EMPTY_INPUT;
  }

  reset() {
    this.input = demoInput();
  }
}

export const mockAnalyticsRepository = new MockAnalyticsRepository();