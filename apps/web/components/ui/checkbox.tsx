import type { InputHTMLAttributes } from "react";

export function Checkbox({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" className="size-4 accent-accent disabled:opacity-50" {...props} />
      {label}
    </label>
  );
}
