"use client";

export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative h-6 w-11 rounded-pill disabled:opacity-50 ${checked ? "bg-accent" : "bg-raised"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-pill bg-ink ${checked ? "right-0.5" : "left-0.5"}`}
      />
    </button>
  );
}
