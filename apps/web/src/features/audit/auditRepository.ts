export type AuditAction = 'delete' | 'void' | 'create_invoice' | 'book' | 'cancel_booking' | 'rebook' | 'create_membership' | 'payment' | 'check_in' | 'update_role' | 'create_class' | 'update_class' | 'delete_class' | 'create_session' | 'update_session' | 'delete_session' | 'delete_booking' | 'create_member';

export type AuditEntry = {
  id: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  details: string | null;
  performedByName: string | null;
  createdAt: string;
};

export interface AuditRepository {
  listAuditEntries(): Promise<AuditEntry[]>;
}

class MockAuditRepository implements AuditRepository {
  private entries: AuditEntry[] = [];

  async listAuditEntries() {
    return [...this.entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  addEntry(entry: Omit<AuditEntry, 'id' | 'createdAt'>) {
    this.entries = [
      {
        ...entry,
        id: `audit-${Date.now()}-${this.entries.length}`,
        createdAt: new Date().toISOString()
      },
      ...this.entries
    ];
  }

  reset() {
    this.entries = [];
  }
}

export const mockAuditRepository = new MockAuditRepository();