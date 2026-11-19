import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number | null;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex h-10 items-center gap-3 rounded-control px-3 text-sm ${active ? "bg-raised text-accent" : "text-ink"}`}
    >
      <Icon size={20} />
      <span className="min-w-0 flex-1">{label}</span>
      {typeof badge === "number" ? (
        <span className="rounded-chip bg-accent px-2 text-[12px] font-bold text-on-accent">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
