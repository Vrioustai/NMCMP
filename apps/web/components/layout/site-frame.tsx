"use client";

import type { Genre } from "@movie/contracts";
import { useState } from "react";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteSidebar } from "./site-sidebar";

export function SiteFrame({ genres, children }: { genres: Genre[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-60">
      <SiteSidebar />
      <SiteHeader menuOpen={open} onMenu={() => setOpen(true)} />
      <main className="min-w-0 px-4 py-4 md:px-6 lg:px-7 2xl:px-12">{children}</main>
      <SiteFooter genres={genres} />
      <div className="lg:hidden">
        <MobileNavDrawer open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  );
}
