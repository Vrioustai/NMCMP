import type { SelectHTMLAttributes } from "react";

export function Select({
  label,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const selectId = id ?? props.name;
  return (
    <label className="grid gap-1 text-sm" htmlFor={selectId}>
      <span>{label}</span>
      <select
        id={selectId}
        className="h-10 rounded-control border border-line bg-raised px-3 text-ink disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
