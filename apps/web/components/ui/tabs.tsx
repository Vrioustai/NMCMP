"use client";

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-2">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={`h-10 rounded-control px-4 text-sm ${selected ? "bg-accent text-on-accent" : "bg-raised text-ink"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
