"use client";

import { Drawer } from "../ui/drawer";
import { AccountMenu } from "./account-menu";
import { SiteNav } from "./site-sidebar";

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} title="Menu" onClose={onClose}>
      <SiteNav onNavigate={onClose} />
      <div className="mt-6 border-t border-line pt-4">
        <AccountMenu />
      </div>
    </Drawer>
  );
}
