"use client";

import { useEffect } from "react";

export function ClearLockedSession() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      } finally {
        if (!cancelled) window.location.assign("/?locked=1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
