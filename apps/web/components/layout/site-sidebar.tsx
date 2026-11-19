"use client";

import { Clapperboard, Heart, History, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";

const LINKS = [
  { href: "/", label: "Trang chủ", icon: Home },
  { href: "/me/favorites", label: "Phim yêu thích", icon: Heart },
  { href: "/search", label: "Thể loại", icon: Clapperboard },
  { href: "/me/history", label: "Lịch sử xem", icon: History },
];

export function SiteNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const Icon = link.icon;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex h-10 items-center gap-3 rounded-control px-3 text-sm ${active ? "bg-raised text-accent" : "text-ink"}`}
          >
            <Icon size={20} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-board p-4 lg:flex">
      <SiteNav />
      <div className="mt-auto border-t border-line pt-4">
        <AccountMenu />
      </div>
    </aside>
  );
}
