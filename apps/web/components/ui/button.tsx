import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary: "bg-linear-to-r from-accent to-accent-2 text-on-accent shadow-glow",
  secondary: "bg-raised text-ink",
  danger: "bg-danger text-ink",
} as const;

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof VARIANTS }) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center rounded-control px-4 text-sm font-semibold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
