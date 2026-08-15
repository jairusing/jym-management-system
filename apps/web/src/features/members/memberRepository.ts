export type Member = {
  id: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
};

export type MemberInput = {
  fullName: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  notes: string | null;
};

export interface MemberRepository {
  listMembers(): Promise<Member[]>;
  createMember(input: MemberInput): Promise<Member>;
  updateMember(id: string, input: Partial<MemberInput>): Promise<Member>;
  setMemberActive(id: string, isActive: boolean): Promise<Member>;
  deleteMember(id: string): Promise<void>;
}

class MockMemberRepository implements MemberRepository {
  private members: Member[] = [];

  async listMembers() {
    return [...this.members].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createMember(input: MemberInput) {
    if (!input.fullName.trim()) {
      throw new Error('Member name is required.');
    }
    const member: Member = {
      id: `member-${Date.now()}-${this.members.length}`,
      userId: null,
      fullName: input.fullName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      joinedAt: input.joinedAt || new Date().toISOString().slice(0, 10),
      notes: input.notes?.trim() || null,
      isActive: true,
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
    const updated: Member = {
      ...current,
      fullName: input.fullName?.trim() || current.fullName,
      email: input.email !== undefined ? (input.email?.trim() || null) : current.email,
      phone: input.phone !== undefined ? (input.phone?.trim() || null) : current.phone,
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

  async deleteMember(id: string) {
    this.members = this.members.filter((member) => member.id !== id);
  }

  reset() {
    this.members = [];
  }
}

export const mockMemberRepository = new MockMemberRepository();