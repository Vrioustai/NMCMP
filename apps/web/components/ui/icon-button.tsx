import type { ButtonHTMLAttributes } from "react";

export function IconButton({
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { "aria-label": string }) {
  return (
    <button
      type={type}
      className={`inline-flex size-10 items-center justify-center rounded-control bg-raised text-ink disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
