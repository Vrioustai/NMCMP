import type { InputHTMLAttributes } from "react";

export function Slider({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      <input type="range" className="accent-accent disabled:opacity-50" {...props} />
    </label>
  );
}
