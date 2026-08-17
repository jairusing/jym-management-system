import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';

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
  id?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function RowMenu({ items, label = 'More', id, open: openProp, onOpenChange }: RowMenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;
  const setOpen = (next: boolean | ((current: boolean) => boolean)) => {
    if (isControlled) {
      onOpenChange?.(typeof next === 'function' ? next(open) : next);
    } else {
      setInternalOpen(next);
    }
  };
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(() => setInternalOpen(false));
  closeRef.current = () => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
  };
  const restoreTriggerFocusRef = useRef(() => {});
  restoreTriggerFocusRef.current = () => {
    if (id) {
      document.getElementById(id)?.focus?.();
    }
  };

  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }
  }, [open]);

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!buttons || buttons.length === 0) {
      return;
    }
    let next = Array.from(buttons).indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        next = next < 0 ? 0 : Math.min(next + 1, buttons.length - 1);
        break;
      case 'ArrowUp':
        next = next < 0 ? 0 : Math.max(next - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = buttons.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons[next]?.focus();
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        closeRef.current();
        restoreTriggerFocusRef.current();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        restoreTriggerFocusRef.current();
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
        id={id}
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
        <div
          role="menu"
          aria-label={label}
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-1 max-h-[min(70vh,24rem)] min-w-52 overflow-y-auto border border-[#262626] bg-[#0F0F0F]"
        >
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