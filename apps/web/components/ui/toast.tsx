"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ToastItem = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useMemo(
    () => (message: string) => {
      const id = Date.now();
      setItems((current) => [...current, { id, message }]);
    },
    [],
  );
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed right-4 bottom-4 z-50 grid gap-2" aria-live="polite">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rounded-control bg-raised px-4 py-3 text-left text-sm text-ink shadow-pop"
            onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
          >
            {item.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
