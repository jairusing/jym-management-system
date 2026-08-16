// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditPage } from './AuditPage';
import { mockAuditRepository } from './auditRepository';

vi.mock('../../lib/supabase', () => ({
  hasSupabaseConfig: false,
  supabase: null
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AuditPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  mockAuditRepository.reset();
});

describe('AuditPage', () => {
  it('renders the empty state', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no destructive actions have been recorded yet/i)).toBeTruthy();
    });
  });

  it('lists void and delete entries with actor and time', async () => {
    mockAuditRepository.addEntry({
      action: 'void',
      targetType: 'invoice',
      targetId: 'invoice-1',
      details: 'INV-123',
      performedByName: 'Juan Dela Cruz'
    });
    mockAuditRepository.addEntry({
      action: 'delete',
      targetType: 'members',
      targetId: 'member-1',
      details: null,
      performedByName: 'Maria Santos'
    });
    mockAuditRepository.addEntry({
      action: 'delete',
      targetType: 'check_ins',
      targetId: 'checkin-1',
      details: null,
      performedByName: null
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/voided invoice/i)).toBeTruthy();
    });
    expect(screen.getByText(/voided invoice \(INV-123\)/)).toBeTruthy();
    expect(screen.getByText(/Juan Dela Cruz/)).toBeTruthy();
    expect(screen.getAllByText(/deleted member/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Maria Santos/)).toBeTruthy();
    expect(screen.getAllByText(/deleted check-in/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Unknown account/)).toBeTruthy();
  });
});