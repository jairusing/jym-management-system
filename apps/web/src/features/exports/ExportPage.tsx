import { useState } from 'react';
import { BackLink } from '../../components/ui/BackLink';
import { PageShell } from '../../components/ui/PageShell';
import { SectionCard } from '../../components/ui/SectionCard';
import { inputClass, primaryButtonClass } from '../../components/ui/buttonClasses';
import { phDateInDays, phDateToday, phDayStartUtc, phDayEndUtc } from '../../lib/dates';
import { hasSupabaseConfig } from '../../lib/supabase';
import { downloadFile } from './download';
import { checkInsToCsv, invoicesToCsv, membersToCsv, paymentsToCsv } from './exportCsv';
import { mockExportRepository, type ExportSection } from './exportRepository';
import { SupabaseExportRepository } from './supabaseExportRepository';

type Feedback = { status: 'busy' | 'done' | 'error'; message?: string };

const initialFeedback: Record<ExportSection, Feedback | { status: 'idle' }> = {
  members: { status: 'idle' },
  invoices: { status: 'idle' },
  payments: { status: 'idle' },
  attendance: { status: 'idle' },
  backup: { status: 'idle' }
};

function statusText(feedback: Feedback | { status: 'idle' }) {
  if (feedback.status === 'busy') {
    return 'Working…';
  }
  if (feedback.status === 'done') {
    return `Downloaded — ${feedback.message}`;
  }
  if (feedback.status === 'error') {
    return feedback.message ?? 'Download failed.';
  }
  return '';
}

export function ExportPage() {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [from, setFrom] = useState(phDateInDays(-29));
  const [to, setTo] = useState(phDateToday());

  const setStatus = (section: ExportSection, next: Feedback) => {
    setFeedback((current) => ({ ...current, [section]: next }));
  };

  const run = async (section: ExportSection, task: () => Promise<void>) => {
    setStatus(section, { status: 'busy' });
    try {
      await task();
      setStatus(section, {
        status: 'done',
        message: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      });
    } catch (e) {
      setStatus(section, { status: 'error', message: e instanceof Error ? e.message : 'Download failed.' });
    }
  };

  const repo = () => (hasSupabaseConfig ? new SupabaseExportRepository() : mockExportRepository);

  const busy = (section: ExportSection) => feedback[section].status === 'busy';
  const show = (section: ExportSection) => {
    const status = feedback[section];
    const text = statusText(status);
    if (!text) {
      return null;
    }
    return (
      <p
        role={status.status === 'error' ? 'alert' : 'status'}
        className={`text-sm ${status.status === 'error' ? 'text-[#FF3D00]' : 'text-[#A3A3A3]'}`}
      >
        {text}
      </p>
    );
  };

  const downloadMembers = () => {
    void run('members', async () => {
      const rows = await repo().listMembersForExport();
      downloadFile(`members-${phDateToday()}.csv`, membersToCsv(rows));
    });
  };

  const downloadInvoices = () => {
    void run('invoices', async () => {
      const rows = await repo().listInvoicesForExport();
      downloadFile(`invoices-${phDateToday()}.csv`, invoicesToCsv(rows));
    });
  };

  const downloadPayments = () => {
    void run('payments', async () => {
      const rows = await repo().listPaymentsForExport();
      downloadFile(`payments-${phDateToday()}.csv`, paymentsToCsv(rows));
    });
  };

  const downloadAttendance = () => {
    if (from > to) {
      setFeedback((current) => ({
        ...current,
        attendance: { status: 'error', message: 'From date must be on or before the To date.' }
      }));
      return;
    }
    void run('attendance', async () => {
      const rows = await repo().listCheckInsForExport(phDayStartUtc(from), phDayEndUtc(to));
      downloadFile(`attendance-${phDateToday()}.csv`, checkInsToCsv(rows));
    });
  };

  const downloadBackup = () => {
    void run('backup', async () => {
      const payload = await repo().getBackup();
      downloadFile(`jym-backup-${phDateToday()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    });
  };

  return (
    <PageShell
      eyebrow="Management"
      title="Exports"
      description="Download copies of your records as CSV, or the whole database as a JSON backup. Read-only — exports never change data."
    >
      <BackLink to="/app" label="Back to dashboard" />

      {!hasSupabaseConfig ? (
        <p className="text-sm text-[#A3A3A3]" role="status">
          Demo data — no live database connected.
        </p>
      ) : null}

      <SectionCard title="Members" description="Every member on file with their current membership details.">
        <button className={primaryButtonClass} type="button" disabled={busy('members')} onClick={downloadMembers}>
          {busy('members') ? 'Working…' : 'Download members CSV'}
        </button>
        {show('members')}
      </SectionCard>

      <SectionCard title="Invoices" description="All invoices with totals, status and dates.">
        <button className={primaryButtonClass} type="button" disabled={busy('invoices')} onClick={downloadInvoices}>
          {busy('invoices') ? 'Working…' : 'Download invoices CSV'}
        </button>
        {show('invoices')}
      </SectionCard>

      <SectionCard title="Payments" description="Every recorded payment with method, reference and who took it.">
        <button className={primaryButtonClass} type="button" disabled={busy('payments')} onClick={downloadPayments}>
          {busy('payments') ? 'Working…' : 'Download payments CSV'}
        </button>
        {show('payments')}
      </SectionCard>

      <SectionCard title="Attendance" description="Check-ins within a date range — pick the days you want.">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            <span>From</span>
            <input
              className={inputClass}
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>To</span>
            <input
              className={inputClass}
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-6">
          <button
            className={primaryButtonClass}
            type="button"
            disabled={busy('attendance')}
            onClick={downloadAttendance}
          >
            {busy('attendance') ? 'Working…' : 'Download attendance CSV'}
          </button>
          {show('attendance')}
        </div>
      </SectionCard>

      <SectionCard
        title="Full backup"
        description="The whole database as one JSON file — members, invoices, payments and check-ins, plus an export timestamp."
      >
        <button className={primaryButtonClass} type="button" disabled={busy('backup')} onClick={downloadBackup}>
          {busy('backup') ? 'Working…' : 'Download backup JSON'}
        </button>
        {show('backup')}
      </SectionCard>
    </PageShell>
  );
}