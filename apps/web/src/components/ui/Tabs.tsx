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
  return (
    <div role="tablist" className="mb-8 flex gap-1 border-b border-[#262626]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={active === tab.id}
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