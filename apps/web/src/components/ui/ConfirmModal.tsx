import { dangerButtonClass, ghostButtonClass, primaryButtonClass } from './buttonClasses';

export type ConfirmModalProps = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0A0A0A]/80 p-4"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onCancel();
        }
      }}
    >
      <div className="w-full max-w-md border border-[#262626] bg-[#0F0F0F] p-6 sm:p-8">
        <p className="text-lg font-semibold tracking-[-0.04em] text-[#FAFAFA]">{title}</p>
        <p className="mt-3 text-sm leading-relaxed text-[#A3A3A3]">{body}</p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {danger ? (
            <>
              <button type="button" autoFocus className={ghostButtonClass} onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className={dangerButtonClass} onClick={onConfirm}>
                {confirmLabel}
              </button>
            </>
          ) : (
            <>
              <button type="button" autoFocus className={primaryButtonClass} onClick={onConfirm}>
                {confirmLabel}
              </button>
              <button type="button" className={ghostButtonClass} onClick={onCancel}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}