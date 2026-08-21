export type UserRole = 'owner' | 'staff' | 'member';

export type StaffProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export interface StaffRepository {
  getMyRole(): Promise<UserRole | null>;
  getMyProfileId(): Promise<string | null>;
  listProfiles(): Promise<StaffProfile[]>;
  updateRole(profileId: string, role: UserRole): Promise<void>;
}

class MockStaffRepository implements StaffRepository {
  private myRole: UserRole | null = 'owner';
  private profiles: StaffProfile[] = [];

  async getMyRole() {
    return this.myRole;
  }

  async getMyProfileId() {
    // The mock has no signed-in identity; the self-demotion guard is a
    // live-mode concern.
    return null;
  }

  async listProfiles() {
    return [...this.profiles];
  }

  async updateRole(profileId: string, role: UserRole) {
    if (this.myRole !== 'owner') {
      throw new Error('Only the owner can change staff roles.');
    }
    this.profiles = this.profiles.map((profile) =>
      profile.id === profileId ? { ...profile, role } : profile
    );
  }

  setMyRole(role: UserRole | null) {
    this.myRole = role;
  }

  setProfiles(profiles: StaffProfile[]) {
    this.profiles = [...profiles];
  }

  reset() {
    this.myRole = 'owner';
    this.profiles = [];
  }
}

export const mockStaffRepository = new MockStaffRepository();