import { useRef } from 'react';
import { Printer } from 'lucide-react';
import { ghostButtonClass, primaryButtonClass } from '../../components/ui/buttonClasses';
import { type ReceiptData } from './receipt';

function ReceiptBody({ receipt, mode }: { receipt: ReceiptData; mode: 'screen' | 'print' }) {
  const isPrint = mode === 'print';
  const strong = isPrint ? 'text-black' : 'text-[#FAFAFA]';
  const muted = isPrint ? 'text-black/70' : 'text-[#A3A3A3]';
  const label = isPrint ? 'text-black/80' : 'text-[#A3A3A3]';
  const border = isPrint ? 'border-black' : 'border-[#262626]';

  return (
    <div className={`p-6 sm:p-8 ${isPrint ? 'bg-white text-black' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className={`text-xl font-semibold tracking-[-0.04em] ${strong}`}>
            Jym <span className="text-[#FF3D00]">Management</span>
          </p>
          <p className={`text-[0.7rem] uppercase tracking-[0.2em] ${label}`}>Official receipt</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className={`text-sm font-semibold ${strong}`}>{receipt.invoiceNumber}</p>
          <p className={`text-xs ${muted}`}>Paid {receipt.paidAtLabel}</p>
        </div>
      </div>

      <div className={`my-6 h-px ${border}`} />

      <dl className="flex flex-col gap-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className={`text-xs uppercase tracking-[0.2em] ${label}`}>Member</dt>
          <dd className={`text-right font-medium ${strong}`}>{receipt.memberName}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className={`text-xs uppercase tracking-[0.2em] ${label}`}>Plan</dt>
          <dd className={`text-right ${strong}`}>{receipt.planName ?? '—'}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className={`text-xs uppercase tracking-[0.2em] ${label}`}>Paid via</dt>
          <dd className={`text-right ${strong}`}>
            {receipt.methodLabel}
            {receipt.reference ? ` · ${receipt.reference}` : ''}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className={`text-xs uppercase tracking-[0.2em] ${label}`}>Taken by</dt>
          <dd className={`text-right ${strong}`}>{receipt.takenBy ?? 'Front desk'}</dd>
        </div>
      </dl>

      <div className={`my-6 h-px ${border}`} />

      <div className="flex flex-col gap-1">
        <p className={`text-[0.7rem] uppercase tracking-[0.2em] ${label}`}>Amount paid</p>
        <p className={`font-mono text-3xl tracking-[-0.03em] ${strong}`}>{receipt.amountLabel}</p>
        <p className={`mt-2 text-xs uppercase tracking-[0.05em] ${muted}`}>{receipt.amountInWords}</p>
      </div>
    </div>
  );
}

type ReceiptDialogProps = {
  receipt: ReceiptData | null;
  onClose: () => void;
};

export function ReceiptDialog({ receipt, onClose }: ReceiptDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  if (!receipt) {
    return null;
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Receipt for ${receipt.invoiceNumber}`}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A0A0A]/80 p-4 print:hidden"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose();
            return;
          }
          if (event.key === 'Tab') {
            const panel = panelRef.current;
            if (!panel) {
              return;
            }
            const focusables = Array.from(
              panel.querySelectorAll<HTMLElement>(
                'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
              )
            );
            if (focusables.length === 0) {
              return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (event.shiftKey) {
              if (active === first || !panel.contains(active)) {
                event.preventDefault();
                last.focus();
              }
            } else if (active === last || !panel.contains(active)) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div ref={panelRef} className="w-full max-w-md border border-[#262626] bg-[#0F0F0F]">
          <ReceiptBody receipt={receipt} mode="screen" />
          <div className="flex flex-wrap gap-4 border-t border-[#262626] p-6">
            <button autoFocus className={primaryButtonClass} type="button" onClick={() => window.print()}>
              <Printer size={16} strokeWidth={1.5} aria-hidden="true" />
              Print receipt
            </button>
            <button className={ghostButtonClass} type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <ReceiptBody receipt={receipt} mode="print" />
      </div>
    </>
  );
}