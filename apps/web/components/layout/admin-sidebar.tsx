"use client";

import { Ban, Film, LayoutDashboard, Shield, Tags, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NavItem } from "../admin/nav-item";
import { apiClient } from "../../lib/api/client";

const GROUPS = [
  {
    title: "Tổng quan",
    items: [{ href: "/admin", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    title: "Nội dung",
    items: [
      { href: "/admin/movies", label: "Phim", icon: Film },
      { href: "/admin/genres", label: "Thể loại", icon: Tags },
    ],
  },
  {
    title: "Hệ thống",
    items: [
      { href: "/admin/users", label: "Người dùng", icon: Users },
      { href: "/admin/reports", label: "Kiểm duyệt", icon: Shield, pending: true },
      { href: "/admin/banned-words", label: "Từ cấm", icon: Ban },
    ],
  },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let gone = false;
    apiClient<{ total: number }>("/admin/reports?status=PENDING&page=1")
      .then((page) => {
        if (!gone && typeof page.total === "number") setPending(page.total);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);

  return (
    <div className="grid gap-5">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="mb-2 px-3 text-[12px] font-semibold tracking-wide text-dim uppercase">
            {group.title}
          </h2>
          <nav className="grid gap-1">
            {group.items.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  active={active}
                  badge={"pending" in item && item.pending ? pending : null}
                  onNavigate={onNavigate}
                />
              );
            })}
          </nav>
        </section>
      ))}
    </div>
  );
}
