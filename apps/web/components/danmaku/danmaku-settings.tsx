"use client";

import { EllipsisVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DENSITIES, type DanmakuSettings } from "../../lib/danmaku/settings";
import { IconButton } from "../ui/icon-button";
import { Switch } from "../ui/switch";

export function DanmakuSettings({
  settings,
  onChange,
}: {
  settings: DanmakuSettings;
  onChange: (patch: Partial<DanmakuSettings>) => void;
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
    <div className="flex items-center gap-2">
      <Switch
        label="Danmaku"
        checked={settings.enabled}
        onCheckedChange={(enabled) => onChange({ enabled })}
      />
      <div ref={root} className="relative">
        <IconButton
          aria-label="Cài đặt Danmaku"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <EllipsisVertical size={20} />
        </IconButton>
        {open ? (
          <div className="absolute right-0 bottom-12 z-20 grid w-56 gap-3 rounded-control bg-board p-3 shadow-pop">
            <div className="grid gap-1">
              <span className="text-[13px] text-muted">Mật độ</span>
              <div className="flex gap-1">
                {DENSITIES.map((density) => (
                  <button
                    key={density}
                    type="button"
                    aria-pressed={settings.density === density}
                    className={`h-8 flex-1 rounded-control text-sm ${settings.density === density ? "bg-accent text-on-accent" : "bg-raised"}`}
                    onClick={() => onChange({ density })}
                  >
                    {density}
                  </button>
                ))}
              </div>
            </div>
            <label className="grid gap-1 text-[13px] text-muted">
              Độ mờ
              <input
                aria-label="Độ mờ"
                type="range"
                min={20}
                max={100}
                step={1}
                value={settings.opacity}
                className="w-full accent-accent"
                onChange={(event) => onChange({ opacity: Number(event.target.value) })}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
