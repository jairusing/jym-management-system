export type CreateLoginInput = {
  memberId: string;
  email: string;
  password: string;
};

export type LinkAccountInput = {
  memberId: string;
  email: string;
};

export interface MemberAccountRepository {
  createLogin(input: CreateLoginInput): Promise<void>;
  linkAccount(input: LinkAccountInput): Promise<void>;
}

export class MockMemberAccountRepository implements MemberAccountRepository {
  calls: CreateLoginInput[] = [];
  linkCalls: LinkAccountInput[] = [];

  async createLogin(input: CreateLoginInput) {
    if (!input.email.trim()) {
      throw new Error('Email is required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new Error('Enter a valid email address.');
    }
    if (input.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    this.calls.push({ ...input, email: input.email.trim().toLowerCase() });
  }

  async linkAccount(input: LinkAccountInput) {
    if (!input.email.trim()) {
      throw new Error('Email is required.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
      throw new Error('Enter a valid email address.');
    }
    this.linkCalls.push({ ...input, email: input.email.trim().toLowerCase() });
  }

  reset() {
    this.calls = [];
    this.linkCalls = [];
  }
}

export const mockMemberAccountRepository = new MockMemberAccountRepository();