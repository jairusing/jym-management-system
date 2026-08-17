import { useRef } from 'react';
import { dangerButtonClass, ghostButtonClass, primaryButtonClass } from './buttonClasses';

export type ConfirmModalProps = {
  title: string;
  body: string;
  confirmLabel: string;
  pendingLabel: string;
  danger?: boolean;
  pending?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  pendingLabel,
  danger,
  pending,
  error,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  const bodyId = `confirm-body-${title.replace(/\W+/g, '-').toLowerCase()}`;
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      aria-describedby={bodyId}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A0A0A]/80 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onCancel();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) {
          onCancel();
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
      <div ref={panelRef} className="w-full max-w-md border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8">
        <p className="text-lg font-semibold tracking-[-0.04em] text-[#FAFAFA]">{title}</p>
        <p id={bodyId} className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">
          {body}
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-[#FF3D00]">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {danger ? (
            <>
              <button
                type="button"
                autoFocus
                disabled={pending}
                className={ghostButtonClass}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                className={dangerButtonClass}
                onClick={onConfirm}
              >
                {pending ? pendingLabel : confirmLabel}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                autoFocus
                disabled={pending}
                className={primaryButtonClass}
                onClick={onConfirm}
              >
                {pending ? pendingLabel : confirmLabel}
              </button>
              <button
                type="button"
                disabled={pending}
                className={ghostButtonClass}
                onClick={onCancel}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
