// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuditPage } from './AuditPage';
import { mockAuditRepository, type AuditEntry } from './auditRepository';
import { SupabaseAuditRepository } from './supabaseAuditRepository';

const supabaseConfig = vi.hoisted(() => ({ hasSupabaseConfig: false }));

vi.mock('../../lib/supabase', () => ({
  get hasSupabaseConfig() {
    return supabaseConfig.hasSupabaseConfig;
  },
  supabase: null
}));

vi.mock('./supabaseAuditRepository', () => ({
  SupabaseAuditRepository: vi.fn()
}));

const SupabaseAuditRepositoryMock = vi.mocked(SupabaseAuditRepository);

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
  supabaseConfig.hasSupabaseConfig = false;
  SupabaseAuditRepositoryMock.mockReset();
});

describe('AuditPage', () => {
  it('renders the empty state', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no destructive actions have been recorded yet/i)).toBeTruthy();
    });
  });

  it('labels the demo dataset when no database is connected', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/demo data/i);
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

  it('labels all new action types correctly', async () => {
    mockAuditRepository.addEntry({
      action: 'create_invoice',
      targetType: 'invoices',
      targetId: 'invoice-2',
      details: 'INV-456',
      performedByName: 'Owner'
    });
    mockAuditRepository.addEntry({
      action: 'book',
      targetType: 'class_bookings',
      targetId: 'booking-1',
      details: null,
      performedByName: 'Juan Dela Cruz'
    });
    mockAuditRepository.addEntry({
      action: 'payment',
      targetType: 'payments',
      targetId: 'payment-1',
      details: null,
      performedByName: 'Maria Santos'
    });
    mockAuditRepository.addEntry({
      action: 'check_in',
      targetType: 'check_ins',
      targetId: 'checkin-2',
      details: null,
      performedByName: null
    });
    mockAuditRepository.addEntry({
      action: 'update_role',
      targetType: 'profiles',
      targetId: 'profile-1',
      details: null,
      performedByName: 'Owner'
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/created invoice/i)).toBeTruthy();
    });
    expect(screen.getByText(/booked a class/i)).toBeTruthy();
    expect(screen.getByText(/recorded a payment/i)).toBeTruthy();
    expect(screen.getAllByText(/checked in/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/updated a role/i)).toBeTruthy();
  });

  it('shows an amber load error instead of mock data when the live load fails, then recovers', async () => {
    supabaseConfig.hasSupabaseConfig = true;
    const sampleEntry: AuditEntry = {
      id: 'entry-1',
      action: 'void',
      targetType: 'invoice',
      targetId: 'invoice-1',
      details: 'INV-1001',
      performedByName: 'Owner',
      createdAt: '2026-08-21T00:00:00.000Z'
    };
    const listAuditEntries = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce([sampleEntry]);
    SupabaseAuditRepositoryMock.mockImplementation(
      () => ({ listAuditEntries }) as unknown as SupabaseAuditRepository
    );
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/Couldn't load activity/i);
    });
    const noticeBox = screen.getByRole('alert').closest('div');
    expect(noticeBox?.className).toContain('border-[#FFB300]');
    expect(noticeBox?.className).toContain('bg-[#1A1A1A]');
    expect(screen.queryByText(/voided invoice \(INV-/)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText(/voided invoice \(INV-1001\)/)).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
