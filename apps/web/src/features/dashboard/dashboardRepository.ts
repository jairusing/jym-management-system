export type DashboardStats = {
  attendanceToday: number;
  attendanceWeek: number;
  revenueMonth: number;
  revenueTotal: number;
  outstandingTotal: number;
  activeMembers: number;
};

export type AttendanceDay = {
  date: string;
  label: string;
  count: number;
};

export type DashboardView = {
  stats: DashboardStats;
  weeklyAttendance: AttendanceDay[];
};

export interface DashboardRepository {
  getDashboard(): Promise<DashboardView>;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function buildWeekly(keys: { checkedInAt: string }[]) {
  const today = startOfToday();
  const days: AttendanceDay[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    days.push({
      date: toDateKey(date),
      label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date),
      count: 0
    });
  }
  for (const key of keys) {
    const keyDate = toDateKey(new Date(key.checkedInAt));
    const day = days.find((candidate) => candidate.date === keyDate);
    if (day) {
      day.count += 1;
    }
  }
  return days;
}

class MockDashboardRepository implements DashboardRepository {
  private checkIns: { checkedInAt: string }[] = [];
  private payments: { amount: number; paidAt: string }[] = [];
  private invoices: { total: number; status: string }[] = [];
  private activeMembers = 0;

  async getDashboard(): Promise<DashboardView> {
    const todayKey = toDateKey(startOfToday());
    const weekAgo = addDays(startOfToday(), -6).toISOString();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const attendanceToday = this.checkIns.filter(
      (checkIn) => toDateKey(new Date(checkIn.checkedInAt)) === todayKey
    ).length;
    const attendanceWeek = this.checkIns.filter(
      (checkIn) => new Date(checkIn.checkedInAt).toISOString() >= weekAgo
    ).length;
    const revenueMonth = this.payments
      .filter((payment) => new Date(payment.paidAt) >= monthStart)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const revenueTotal = this.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const outstandingTotal = this.invoices
      .filter((invoice) => invoice.status !== 'paid' && invoice.status !== 'void')
      .reduce((sum, invoice) => sum + invoice.total, 0);

    return {
      stats: {
        attendanceToday,
        attendanceWeek,
        revenueMonth,
        revenueTotal,
        outstandingTotal,
        activeMembers: this.activeMembers
      },
      weeklyAttendance: buildWeekly(this.checkIns)
    };
  }

  seed(data: {
    checkIns?: { checkedInAt: string }[];
    payments?: { amount: number; paidAt: string }[];
    invoices?: { total: number; status: string }[];
    activeMembers?: number;
  }) {
    this.checkIns = data.checkIns ?? [];
    this.payments = data.payments ?? [];
    this.invoices = data.invoices ?? [];
    this.activeMembers = data.activeMembers ?? 0;
  }

  reset() {
    this.checkIns = [];
    this.payments = [];
    this.invoices = [];
    this.activeMembers = 0;
  }
}

export const mockDashboardRepository = new MockDashboardRepository();