import { type Membership } from '../members/memberRepository';

export type SelfServiceAccount = {
  memberId: string;
  memberName: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  isActive: boolean;
  membership: Membership | null;
};

export interface SelfServiceRepository {
  // Read-only: RLS policy members_select_staff_or_self lets a member see
  // their own record (and the memberships embedded on it), but not edit it.
  getMyAccount(): Promise<SelfServiceAccount | null>;
}

const DEMO_ACCOUNT: SelfServiceAccount = {
  memberId: 'member-demo',
  memberName: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '0917 000 0000',
  joinedAt: '2026-08-01',
  isActive: true,
  membership: {
    planName: 'Monthly Pass',
    startsAt: '2026-08-01',
    endsAt: '2026-08-31',
    status: 'active'
  }
};

class MockSelfServiceRepository implements SelfServiceRepository {
  private account: SelfServiceAccount | null = DEMO_ACCOUNT;

  async getMyAccount() {
    return this.account ? { ...this.account } : null;
  }

  setMyAccount(account: SelfServiceAccount | null) {
    this.account = account;
  }

  reset() {
    this.account = DEMO_ACCOUNT;
  }
}

export const mockSelfServiceRepository = new MockSelfServiceRepository();