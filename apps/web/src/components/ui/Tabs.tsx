import { type KeyboardEvent } from 'react';

export type Tab = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: readonly Tab[];
  active: string;
  onChange: (id: string) => void;
};

export function Tabs({ tabs, active, onChange }: TabsProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === active);
    if (index === -1) {
      return;
    }
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + delta + tabs.length) % tabs.length;
    event.preventDefault();
    onChange(tabs[next].id);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons[next]?.focus();
  };

  return (
    <div role="tablist" className="mb-8 flex gap-1 border-b border-[#262626]" onKeyDown={onKeyDown}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          className={`border-b-2 px-4 py-3 text-sm font-semibold uppercase tracking-[0.1em] transition-colors duration-150 ${
            active === tab.id
              ? 'border-[#FF3D00] text-[#FAFAFA]'
              : 'border-transparent text-[#A3A3A3] hover:text-[#FAFAFA]'
          }`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
