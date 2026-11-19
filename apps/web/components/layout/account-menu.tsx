"use client";

import Link from "next/link";
import { useSession } from "../../lib/session";
import { LogoutButton } from "./logout-button";

export function AccountMenu() {
  const user = useSession();
  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="rounded-control px-3 py-2">
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="rounded-control bg-accent px-3 py-2 font-semibold text-on-accent"
        >
          Đăng ký
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/me" className="max-w-40 truncate rounded-control px-3 py-2 text-sm">
        {user.displayName}
      </Link>
      <LogoutButton className="rounded-control px-3 py-2 text-sm text-muted disabled:opacity-50" />
    </div>
  );
}
