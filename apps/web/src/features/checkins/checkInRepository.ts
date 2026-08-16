import { phDateToday, phDayStartUtc } from '../../lib/dates';

export type CheckInMethod = 'manual' | 'qr';

export type CheckIn = {
  id: string;
  memberId: string;
  memberName: string;
  checkedInAt: string;
  method: CheckInMethod;
  processedBy: string | null;
};

export type CheckInInput = {
  memberId: string;
  memberName: string;
  method?: CheckInMethod;
};

export interface CheckInRepository {
  listTodayCheckIns(): Promise<CheckIn[]>;
  listCheckIns(from: string, to: string): Promise<CheckIn[]>;
  recordCheckIn(input: CheckInInput): Promise<CheckIn>;
  deleteCheckIn(id: string): Promise<void>;
}

class MockCheckInRepository implements CheckInRepository {
  private checkIns: CheckIn[] = [];

  async listTodayCheckIns() {
    return [...this.checkIns].sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  }

  async listCheckIns(from: string, to: string) {
    return this.checkIns
      .filter((checkIn) => checkIn.checkedInAt >= from && checkIn.checkedInAt <= to)
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  }

  async recordCheckIn(input: CheckInInput) {
    if (!input.memberId || !input.memberName.trim()) {
      throw new Error('Select a member to check in.');
    }
    const startOfToday = phDayStartUtc(phDateToday());
    const alreadyCheckedIn = this.checkIns.some(
      (checkIn) => checkIn.memberId === input.memberId && checkIn.checkedInAt >= startOfToday
    );
    if (alreadyCheckedIn) {
      throw new Error('Already checked in today.');
    }
    const checkIn: CheckIn = {
      id: `checkin-${Date.now()}-${this.checkIns.length}`,
      memberId: input.memberId,
      memberName: input.memberName.trim(),
      checkedInAt: new Date().toISOString(),
      method: input.method ?? 'manual',
      processedBy: null
    };
    this.checkIns = [checkIn, ...this.checkIns];
    return checkIn;
  }

  async deleteCheckIn(id: string) {
    const index = this.checkIns.findIndex((checkIn) => checkIn.id === id);
    if (index === -1) {
      throw new Error('Check-in not found.');
    }
    this.checkIns = this.checkIns.filter((checkIn) => checkIn.id !== id);
  }

  reset() {
    this.checkIns = [];
  }
}

export const mockCheckInRepository = new MockCheckInRepository();