"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "../../lib/api/client";

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await apiClient("/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      setPending(false);
    }
  }

  return (
    <button type="button" className={className} onClick={() => void logout()} disabled={pending}>
      Đăng xuất
    </button>
  );
}
