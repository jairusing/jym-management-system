export type MyMembership = {
  memberId: string;
  memberName: string;
  planName: string;
  planPrice: number;
  startedAt: string;
  endsAt: string;
  status: string;
};

export interface MembershipRepository {
  getMyMembership(): Promise<MyMembership | null>;
}

const defaultMembership: MyMembership = {
  memberId: 'member-1',
  memberName: 'Juan Dela Cruz',
  planName: 'Monthly Pass',
  planPrice: 1500,
  startedAt: '2026-08-01',
  endsAt: '2026-08-31',
  status: 'active'
};

class MockMembershipRepository implements MembershipRepository {
  private membership: MyMembership | null = defaultMembership;

  async getMyMembership() {
    return this.membership;
  }

  setMyMembership(membership: MyMembership | null) {
    this.membership = membership;
  }

  reset() {
    this.membership = defaultMembership;
  }
}

export const mockMembershipRepository = new MockMembershipRepository();