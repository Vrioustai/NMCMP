import type { InputHTMLAttributes } from "react";

export function Input({
  label,
  error,
  id,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const inputId = id ?? props.name;
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  return (
    <label className="grid gap-1 text-sm" htmlFor={inputId}>
      <span>{label}</span>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`h-10 rounded-control border border-line bg-raised px-3 text-base text-ink disabled:opacity-50 md:text-sm ${className}`}
      />
      {error ? (
        <span id={errorId} className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
