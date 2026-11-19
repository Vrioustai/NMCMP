"use client";

import { useEffect, useId, useRef } from "react";

export function Drawer({
  open,
  title,
  onClose,
  placement = "left",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  placement?: "left" | "bottom";
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-scrim"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          placement === "bottom"
            ? "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-panel bg-board p-4 shadow-pop"
            : "absolute inset-y-0 left-0 w-60 max-w-[80vw] overflow-y-auto bg-board p-4 shadow-pop"
        }
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        <button type="button" className="sr-only" onClick={onClose}>
          Đóng
        </button>
        {children}
      </div>
    </div>
  );
}
