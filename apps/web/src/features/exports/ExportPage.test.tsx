// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { phDateInDays, phDateToday } from '../../lib/dates';
import { mockMemberRepository } from '../members/memberRepository';
import { downloadFile } from './download';
import { ExportPage } from './ExportPage';
import { mockExportRepository } from './exportRepository';

vi.mock('../../lib/supabase', () => ({ hasSupabaseConfig: false, supabase: null }));

vi.mock('./download', () => ({
  downloadFile: vi.fn()
}));

const downloadFileMock = vi.mocked(downloadFile);

function renderPage() {
  return render(<ExportPage />);
}

beforeEach(() => {
  mockExportRepository.reset();
  downloadFileMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ExportPage', () => {
  it('shows the four CSV export cards and the backup card', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Download members CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download invoices CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download payments CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download attendance CSV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download backup JSON' })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('defaults the attendance range to the last 30 days', () => {
    renderPage();

    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe(phDateInDays(-29));
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe(phDateToday());
  });

  it('downloads the members CSV from the mock repository', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Juan Dela Cruz',
      email: 'juan@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Download members CSV' }));

    await waitFor(() => {
      expect(downloadFileMock).toHaveBeenCalledTimes(1);
    });
    const [filename, content] = downloadFileMock.mock.calls[0] ?? [];
    expect(filename).toMatch(/^members-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(content).toContain('Full name');
    expect(content).toContain('Juan Dela Cruz');
    expect(content).toContain('juan@example.com');
    expect(await screen.findByText(/Downloaded/)).toBeTruthy();
  });

  it('downloads the backup JSON with member data', async () => {
    await mockMemberRepository.createMember({
      fullName: 'Ana Santos',
      email: 'ana@example.com',
      phone: null,
      joinedAt: '2026-08-01',
      notes: null
    });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Download backup JSON' }));

    await waitFor(() => {
      expect(downloadFileMock).toHaveBeenCalledTimes(1);
    });
    const [filename, content, type] = downloadFileMock.mock.calls[0] ?? [];
    expect(filename).toMatch(/^jym-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(type).toBe('application/json;charset=utf-8');
    expect(content).toContain('"members"');
    expect(content).toContain('Ana Santos');
  });

  it('shows an export error and succeeds on retry', async () => {
    mockExportRepository.setFailures(['members']);
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Download members CSV' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Export failed on purpose.');

    mockExportRepository.setFailures([]);
    fireEvent.click(screen.getByRole('button', { name: 'Download members CSV' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(await screen.findByText(/Downloaded/)).toBeTruthy();
  });
});