import { phDateToday } from '../../lib/dates';

export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'paused';

export type Membership = {
  planName: string;
  startsAt: string;
  endsAt: string;
  status: MembershipStatus;
};

export type Member = {
  id: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  notes: string | null;
  isActive: boolean;
  membership: Membership | null;
  createdAt: string;
};

export type MemberInput = {
  fullName: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  notes: string | null;
};

export function toJoinedAt(input: string | null | undefined) {
  const joined = input || phDateToday();
  return joined === phDateToday() ? new Date().toISOString() : `${joined}T00:00:00+08:00`;
}

export interface MemberRepository {
  listMembers(): Promise<Member[]>;
  createMember(input: MemberInput): Promise<Member>;
  updateMember(id: string, input: Partial<MemberInput>): Promise<Member>;
  setMemberActive(id: string, isActive: boolean): Promise<Member>;
  setMembershipStatus(id: string, status: 'active' | 'paused' | 'cancelled'): Promise<Member>;
  setMemberPin(id: string, pin: string | null): Promise<Member>;
  verifyMemberPin(id: string, pin: string): Promise<'ok' | 'missing' | 'fail'>;
  deleteMember(id: string): Promise<void>;
}

class MockMemberRepository implements MemberRepository {
  private members: Member[] = [];
  private history: Record<string, Membership[]> = {};
  private pins: Record<string, string> = {};

  async listMembers() {
    return [...this.members].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listMembershipHistory(memberId: string) {
    return this.history[memberId] ?? [];
  }

  async createMember(input: MemberInput) {
    if (!input.fullName.trim()) {
      throw new Error('Member name is required.');
    }
    const email = input.email?.trim() || null;
    const phone = input.phone?.trim() || null;
    if (email && this.members.some((member) => member.email?.toLowerCase().trim() === email.toLowerCase())) {
      throw new Error('A member with this email already exists.');
    }
    if (phone && this.members.some((member) => member.phone?.toLowerCase().trim() === phone.toLowerCase())) {
      throw new Error('A member with this phone number already exists.');
    }
    const member: Member = {
      id: `member-${Date.now()}-${this.members.length}`,
      userId: null,
      fullName: input.fullName.trim(),
      email,
      phone,
      joinedAt: toJoinedAt(input.joinedAt),
      notes: input.notes?.trim() || null,
      isActive: true,
      membership: null,
      createdAt: new Date().toISOString()
    };
    this.members = [member, ...this.members];
    return member;
  }

  async updateMember(id: string, input: Partial<MemberInput>) {
    const index = this.members.findIndex((member) => member.id === id);
    if (index === -1) {
      throw new Error('Member not found.');
    }
    const current = this.members[index];
    if (!current) {
      throw new Error('Member not found.');
    }
    const email = input.email !== undefined ? (input.email?.trim() || null) : current.email;
    const phone = input.phone !== undefined ? (input.phone?.trim() || null) : current.phone;
    if (
      email &&
      this.members.some((member) => member.id !== id && member.email?.toLowerCase().trim() === email.toLowerCase())
    ) {
      throw new Error('A member with this email already exists.');
    }
    if (
      phone &&
      this.members.some((member) => member.id !== id && member.phone?.toLowerCase().trim() === phone.toLowerCase())
    ) {
      throw new Error('A member with this phone number already exists.');
    }
    const updated: Member = {
      ...current,
      fullName: input.fullName?.trim() || current.fullName,
      email,
      phone,
      joinedAt: input.joinedAt || current.joinedAt,
      notes: input.notes !== undefined ? (input.notes?.trim() || null) : current.notes
    };
    this.members = this.members.map((member) => (member.id === id ? updated : member));
    return updated;
  }

  async setMemberActive(id: string, isActive: boolean) {
    const index = this.members.findIndex((member) => member.id === id);
    if (index === -1) {
      throw new Error('Member not found.');
    }
    const current = this.members[index];
    if (!current) {
      throw new Error('Member not found.');
    }
    const updated: Member = { ...current, isActive };
    this.members = this.members.map((member) => (member.id === id ? updated : member));
    return updated;
  }

  async setMembershipStatus(id: string, status: 'active' | 'paused' | 'cancelled') {
    const index = this.members.findIndex((member) => member.id === id);
    if (index === -1) {
      throw new Error('Member not found.');
    }
    const current = this.members[index];
    if (!current) {
      throw new Error('Member not found.');
    }
    if (!current.membership) {
      throw new Error('No active membership to update.');
    }
    const updated: Member = { ...current, membership: { ...current.membership, status } };
    this.members = this.members.map((member) => (member.id === id ? updated : member));
    return updated;
  }

  async setMemberPin(id: string, pin: string | null) {
    const index = this.members.findIndex((member) => member.id === id);
    if (index === -1) {
      throw new Error('Member not found.');
    }
    if (pin !== null && !/^\d{4,6}$/.test(pin)) {
      throw new Error('PIN must be 4-6 digits.');
    }
    if (pin === null) {
      delete this.pins[id];
    } else {
      this.pins[id] = pin;
    }
    return this.members[index] as Member;
  }

  async verifyMemberPin(id: string, pin: string): Promise<'ok' | 'missing' | 'fail'> {
    const stored = this.pins[id];
    if (stored === undefined) {
      return 'missing';
    }
    return stored === pin ? 'ok' : 'fail';
  }

  linkAccount(memberId: string, userId: string) {
    this.members = this.members.map((member) =>
      member.id === memberId ? { ...member, userId } : member
    );
  }

  setMembership(memberId: string, membership: Membership | null) {
    this.members = this.members.map((member) =>
      member.id === memberId ? { ...member, membership } : member
    );
  }

  setMembershipHistory(memberId: string, memberships: Membership[]) {
    this.setMembership(memberId, memberships[0] ?? null);
    this.history = { ...this.history, [memberId]: memberships };
  }

  async deleteMember(id: string) {
    this.members = this.members.filter((member) => member.id !== id);
  }

  reset() {
    this.members = [];
  }
}

export const mockMemberRepository = new MockMemberRepository();