"use client";

import {
  DANMAKU_COOLDOWN_MS,
  DANMAKU_MAX_LENGTH,
  type DanmakuRejectReason,
} from "@movie/contracts";
import { useEffect, useId, useState } from "react";
import { Button } from "../ui/button";

export type DanmakuLink = "connecting" | "live" | "reconnecting" | "denied";

export function rejectMessage(reason: DanmakuRejectReason | undefined): string {
  if (reason === "TOO_LONG") return "Bình luận dài quá 100 ký tự.";
  if (reason === "BANNED_WORD") return "Bình luận có từ không được phép.";
  if (reason === "RATE_LIMIT") return "Đợi một chút rồi gửi tiếp.";
  return "Không gửi được.";
}

export function DanmakuComposer({
  status,
  notice,
  cooldownUntil,
  onSend,
}: {
  status: DanmakuLink;
  notice: string | null;
  cooldownUntil: number;
  onSend: (content: string) => void;
}) {
  const fieldId = useId();
  const [value, setValue] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [localUntil, setLocalUntil] = useState(0);

  useEffect(() => {
    const until = Math.max(cooldownUntil, localUntil);
    if (until <= Date.now()) return;
    if (cooldownUntil > Date.now()) setValue("");
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [cooldownUntil, localUntil]);

  const remaining = DANMAKU_MAX_LENGTH - Array.from(value).length;
  const cooling = Math.max(cooldownUntil, localUntil) > now;
  const locked = status !== "live" || cooling || value.trim() === "";
  const statusText =
    status === "reconnecting"
      ? "Đang kết nối lại…"
      : status === "connecting"
        ? "Đang kết nối…"
        : status === "denied"
          ? "Không vào được phòng bình luận."
          : null;

  return (
    <form
      className="grid gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (locked) return;
        setLocalUntil(Date.now() + DANMAKU_COOLDOWN_MS);
        onSend(value);
      }}
    >
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={fieldId}>
          Bình luận
        </label>
        <input
          id={fieldId}
          value={value}
          placeholder="Gửi bình luận"
          className="h-10 min-w-0 flex-1 rounded-control bg-raised px-3 text-sm"
          onChange={(event) => setValue(event.target.value)}
        />
        <span className={`w-8 text-right text-sm ${remaining < 0 ? "text-danger" : "text-muted"}`}>
          {remaining}
        </span>
        <Button type="submit" disabled={locked}>
          Gửi
        </Button>
      </div>
      {statusText ? <p className="text-[13px] text-muted">{statusText}</p> : null}
      {notice ? (
        <p role="alert" className="text-[13px] text-danger">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
