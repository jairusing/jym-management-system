import { describe, expect, it } from 'vitest';
import { type AnalyticsInput, computeAnalytics } from './analyticsRepository';

const TODAY = '2026-08-28';

function iso(date: string, hour = 9) {
  return `${date}T${String(hour).padStart(2, '0')}:00:00+08:00`;
}

const input: AnalyticsInput = {
  checkIns: [
    { memberId: 'm1', checkedInAt: iso('2026-08-28', 8) },
    { memberId: 'm1', checkedInAt: iso('2026-08-27', 8) },
    { memberId: 'm2', checkedInAt: iso('2026-08-27', 17) },
    { memberId: 'm2', checkedInAt: iso('2026-08-26', 18) },
    { memberId: 'm3', checkedInAt: iso('2026-08-25', 9) },
    { memberId: 'm3', checkedInAt: iso('2026-08-25', 20) },
    { memberId: 'm5', checkedInAt: iso('2026-07-01', 9) }
  ],
  memberships: [
    { memberId: 'm1', startedAt: '2026-07-01', endedAt: '2026-08-27', status: 'expired' },
    { memberId: 'm1', startedAt: '2026-08-28', endedAt: '2026-09-27', status: 'active' },
    { memberId: 'm2', startedAt: '2026-06-01', endedAt: '2026-08-20', status: 'expired' },
    { memberId: 'm3', startedAt: '2026-07-01', endedAt: '2026-07-25', status: 'expired' },
    { memberId: 'm4', startedAt: '2026-06-01', endedAt: '2026-07-15', status: 'expired' }
  ],
  members: [
    { id: 'm1', fullName: 'Juan Dela Cruz' },
    { id: 'm2', fullName: 'Maria Santos' },
    { id: 'm3', fullName: 'Pedro Reyes' },
    { id: 'm4', fullName: 'Ana Lim' },
    { id: 'm5', fullName: 'Kiko Aquino' }
  ],
  payments: [
    { memberId: 'm1', amount: 1500, paidAt: iso('2026-08-28', 9) },
    { memberId: 'm1', amount: 4500, paidAt: iso('2026-08-20', 9) },
    { memberId: 'm2', amount: 1500, paidAt: iso('2026-08-27', 9) },
    { memberId: 'm4', amount: 1500, paidAt: iso('2026-08-28', 9) },
    { memberId: 'm4', amount: 9999, paidAt: iso('2026-07-01', 9) }
  ]
};

describe('computeAnalytics', () => {
  it('computes attendance for the 30-day window', () => {
    const snapshot = computeAnalytics(input, 30, TODAY);

    expect(snapshot.windowDays).toBe(30);
    expect(snapshot.fromDate).toBe('2026-07-30');
    expect(snapshot.toDate).toBe(TODAY);

    // m5's visit and m4's early payment fall outside the window.
    expect(snapshot.totalCheckIns).toBe(6);
    expect(snapshot.uniqueVisitors).toBe(3);
    expect(snapshot.dailyAverage).toBe(0.2);
    expect(snapshot.peakDay).toEqual({ date: '2026-08-25', count: 2 });
  });

  it('counts pool as memberships overlapping the window plus visitors', () => {
    const snapshot = computeAnalytics(input, 30, TODAY);

    // In-window memberships: m1 (both rows), m2, m3. Visitors add none new.
    expect(snapshot.memberPool).toBe(3);
    expect(snapshot.attendanceRate).toBe(100);
  });

  it('computes retention from members active at window start', () => {
    const snapshot = computeAnalytics(input, 30, TODAY);

    // Coverage of 2026-07-30: m1 (row 1) and m2. m1 renewed -> still active.
    expect(snapshot.activeAtStart).toBe(2);
    expect(snapshot.stillActive).toBe(1);
    expect(snapshot.retentionRate).toBe(50);
  });

  it('computes churn from memberships that ended inside the window', () => {
    const snapshot = computeAnalytics(input, 30, TODAY);

    // Ended in [07-30..08-28]: m1 (row 1) and m2; m1 renewed.
    expect(snapshot.expiredThisWindow).toBe(2);
    expect(snapshot.renewedThisWindow).toBe(1);
    expect(snapshot.churnedThisWindow).toBe(1);
    expect(snapshot.churnRate).toBe(50);
  });

  it('sums in-window payments and ranks top members', () => {
    const snapshot = computeAnalytics(input, 30, TODAY);

    expect(snapshot.totalCollected).toBe(9000);
    expect(snapshot.topMembers).toHaveLength(3);
    expect(snapshot.topMembers[0]).toEqual({
      memberId: 'm1',
      memberName: 'Juan Dela Cruz',
      totalPaid: 6000,
      checkIns: 2
    });
    expect(snapshot.topMembers[1]?.memberName).toBe('Ana Lim');
    expect(snapshot.topMembers[2]?.memberName).toBe('Maria Santos');
  });

  it('returns null rates and empty lists when there is no data', () => {
    const snapshot = computeAnalytics(
      { checkIns: [], memberships: [], members: [], payments: [] },
      30,
      TODAY
    );

    expect(snapshot.totalCheckIns).toBe(0);
    expect(snapshot.uniqueVisitors).toBe(0);
    expect(snapshot.dailyAverage).toBe(0);
    expect(snapshot.peakDay).toBeNull();
    expect(snapshot.memberPool).toBe(0);
    expect(snapshot.attendanceRate).toBeNull();
    expect(snapshot.activeAtStart).toBe(0);
    expect(snapshot.stillActive).toBe(0);
    expect(snapshot.retentionRate).toBeNull();
    expect(snapshot.expiredThisWindow).toBe(0);
    expect(snapshot.churnRate).toBeNull();
    expect(snapshot.totalCollected).toBe(0);
    expect(snapshot.topMembers).toEqual([]);
  });

  it('widening the window changes retention because no plan covered 90 days ago', () => {
    const snapshot = computeAnalytics(input, 90, TODAY);

    expect(snapshot.fromDate).toBe('2026-05-31');
    expect(snapshot.activeAtStart).toBe(0);
    expect(snapshot.retentionRate).toBeNull();
    // m3 and m4 memberships also lapsed within the wider window.
    expect(snapshot.expiredThisWindow).toBe(4);
    expect(snapshot.churnRate).toBe(75);
  });
});