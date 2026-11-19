"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Drawer } from "../ui/drawer";
import { IconButton } from "../ui/icon-button";
import { AdminNav } from "./admin-sidebar";

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-[260px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[260px] overflow-y-auto bg-board p-4 lg:block">
        <AdminNav />
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-board px-4 lg:hidden">
        <IconButton
          aria-label="Mở menu quản trị"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu size={20} />
        </IconButton>
        <span className="text-sm font-semibold">Quản trị</span>
      </header>
      <main className="min-w-0 px-4 py-4 md:px-6 lg:px-7">{children}</main>
      <div className="lg:hidden">
        <Drawer open={open} title="Menu quản trị" onClose={() => setOpen(false)}>
          <AdminNav onNavigate={() => setOpen(false)} />
        </Drawer>
      </div>
    </div>
  );
}
