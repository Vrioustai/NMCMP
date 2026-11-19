"use client";

import { Captions } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "../ui/icon-button";

export function SubtitleMenu({
  disabled,
  enabled,
  onChange,
}: {
  disabled: boolean;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <IconButton
        aria-label="Phụ đề"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <Captions size={20} />
      </IconButton>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 bottom-12 z-10 grid w-40 rounded-control bg-board p-1 shadow-pop"
        >
          <button
            type="button"
            role="menuitemradio"
            aria-checked={enabled}
            className="rounded-control px-3 py-2 text-left text-sm"
            onClick={() => {
              onChange(true);
              setOpen(false);
            }}
          >
            Tiếng Việt
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!enabled}
            className="rounded-control px-3 py-2 text-left text-sm"
            onClick={() => {
              onChange(false);
              setOpen(false);
            }}
          >
            Tắt phụ đề
          </button>
        </div>
      ) : null}
    </div>
  );
}
