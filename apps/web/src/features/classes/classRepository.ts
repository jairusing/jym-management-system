export type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  trainerId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
};

export type ClassInput = {
  name: string;
  capacity: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type ClassSession = {
  id: string;
  classId: string;
  className: string;
  scheduledAt: string;
  endTime: string;
  capacity: number;
  status: 'scheduled' | 'cancelled' | 'completed';
};

export const dayOfWeekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface ClassRepository {
  listClasses(): Promise<ClassItem[]>;
  createClass(input: ClassInput): Promise<ClassItem>;
  deleteClass(id: string): Promise<void>;
  listSessions(from: string, to: string): Promise<ClassSession[]>;
  createSession(classId: string, scheduledAt: string): Promise<ClassSession>;
}

class MockClassRepository implements ClassRepository {
  private classes: ClassItem[] = [];
  private sessions: ClassSession[] = [];

  async listClasses() {
    return [...this.classes].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  }

  async createClass(input: ClassInput) {
    if (!input.name.trim()) {
      throw new Error('Class name is required.');
    }
    if (input.endTime <= input.startTime) {
      throw new Error('End time must be after start time.');
    }
    const gymClass: ClassItem = {
      id: `class-${Date.now()}-${this.classes.length}`,
      name: input.name.trim(),
      description: null,
      capacity: input.capacity,
      trainerId: null,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    this.classes = [...this.classes, gymClass];
    return gymClass;
  }

  async deleteClass(id: string) {
    this.classes = this.classes.filter((gymClass) => gymClass.id !== id);
    this.sessions = this.sessions.filter((session) => session.classId !== id);
  }

  async listSessions(from: string, to: string) {
    return this.sessions
      .filter((session) => session.scheduledAt >= from && session.scheduledAt < to)
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  }

  async createSession(classId: string, scheduledAt: string) {
    const gymClass = this.classes.find((candidate) => candidate.id === classId);
    if (!gymClass) {
      throw new Error('Class not found.');
    }
    const session: ClassSession = {
      id: `session-${Date.now()}-${this.sessions.length}`,
      classId,
      className: gymClass.name,
      scheduledAt: new Date(`${scheduledAt}T${gymClass.startTime}`).toISOString(),
      endTime: gymClass.endTime,
      capacity: gymClass.capacity,
      status: 'scheduled'
    };
    this.sessions = [...this.sessions, session];
    return session;
  }

  reset() {
    this.classes = [];
    this.sessions = [];
  }
}

export const mockClassRepository = new MockClassRepository();