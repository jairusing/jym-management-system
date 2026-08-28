// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReceiptDialog } from './ReceiptDialog';
import { buildReceipt, type ReceiptSource } from './receipt';

const source: ReceiptSource = {
  invoiceNumber: 'INV-2026-0001',
  memberName: 'Juan Dela Cruz',
  planName: 'Monthly Pass',
  amount: 1500,
  method: 'gcash',
  reference: 'G-12345',
  paidAt: '2026-08-28T09:30:00+08:00',
  takenBy: 'Front desk'
};

function renderDialog(onClose: () => void = () => {}) {
  return render(<ReceiptDialog receipt={buildReceipt(source)} onClose={onClose} />);
}

function mockPrint() {
  if (typeof (window as { print?: unknown }).print !== 'function') {
    (window as { print: () => void }).print = () => {};
  }
  return vi.spyOn(window, 'print').mockImplementation(() => {});
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReceiptDialog', () => {
  it('renders the receipt details', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Receipt for INV-2026-0001' });
    expect(within(dialog).getAllByText('INV-2026-0001').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('Juan Dela Cruz').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('GCash · G-12345').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText('₱1,500.00').length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText(/One Thousand Five Hundred Pesos/).length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Print receipt' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('renders nothing when there is no receipt', () => {
    const { container } = render(<ReceiptDialog receipt={null} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls window.print when the print button is clicked', () => {
    const print = mockPrint();
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Print receipt' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('closes on Close', () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.keyDown(screen.getByRole('dialog', { name: /Receipt for INV-/ }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});