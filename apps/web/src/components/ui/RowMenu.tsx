import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type RowMenuItem = {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  onClick: () => void;
};

type RowMenuProps = {
  items: RowMenuItem[];
  label?: string;
};

export function RowMenu({ items, label = 'More' }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex items-center gap-2 px-2 py-2 text-sm font-semibold uppercase tracking-[0.1em] text-[#A3A3A3] transition-colors duration-150 hover:text-[#FAFAFA]"
      >
        <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
        {label}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-52 border border-[#262626] bg-[#0F0F0F]">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col">
              {item.divider ? <div className="mx-3 my-1 h-px bg-[#262626]" /> : null}
              <button
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-150 disabled:opacity-50 ${
                  item.danger
                    ? 'text-[#FF3D00] hover:bg-[#1A1A1A]'
                    : 'text-[#A3A3A3] hover:bg-[#1A1A1A] hover:text-[#FAFAFA]'
                }`}
              >
                {item.icon ? <item.icon size={14} strokeWidth={1.5} aria-hidden="true" /> : null}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}