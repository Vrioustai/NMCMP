"use client";

import { REPORT_MAX_LENGTH } from "@movie/contracts";
import { useLayoutEffect, useRef, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { ApiError } from "../../lib/api/errors";
import { REPORT_OTHER, REPORT_PRESETS, chosenReason } from "../../lib/danmaku/report";
import { errorMessage } from "../../lib/error-messages";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export function ReportDialog({
  open,
  danmakuId,
  content,
  onClose,
  onReported,
}: {
  open: boolean;
  danmakuId: number;
  content: string;
  onClose: () => void;
  onReported: () => void;
}) {
  const [choice, setChoice] = useState<string>(REPORT_PRESETS[0]);
  const [custom, setCustom] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = chosenReason(choice, custom);
  const remaining = REPORT_MAX_LENGTH - Array.from(custom).length;

  async function submit() {
    if (!reason || pending) return;
    setPending(true);
    setError(null);
    try {
      await apiClient(`/reports`, { method: "POST", body: { danmakuId, reason } });
      onReported();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "ALREADY_REPORTED") onReported();
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title="Báo cáo bình luận" onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">Chọn lý do để báo cáo bình luận này cho quản trị viên.</p>
        <Quoted text={content} />
        <fieldset className="grid gap-2">
          <legend className="sr-only">Lý do</legend>
          {REPORT_PRESETS.map((preset) => (
            <label key={preset} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="report-reason"
                checked={choice === preset}
                onChange={() => setChoice(preset)}
              />
              {preset}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="report-reason"
              checked={choice === REPORT_OTHER}
              onChange={() => setChoice(REPORT_OTHER)}
            />
            Khác
          </label>
        </fieldset>
        {choice === REPORT_OTHER ? (
          <label className="grid gap-1 text-sm">
            Lý do khác
            <textarea
              value={custom}
              rows={3}
              className="rounded-control bg-raised px-3 py-2 text-base"
              onChange={(event) => setCustom(event.target.value)}
            />
            <span className={`text-[13px] ${remaining < 0 ? "text-danger" : "text-muted"}`}>
              {remaining}
            </span>
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button disabled={reason === null || pending} onClick={() => void submit()}>
            Gửi báo cáo
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Quoted({ text }: { text: string }) {
  const node = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (node.current) node.current.textContent = text;
  }, [text]);
  return <p ref={node} className="rounded-control bg-raised px-3 py-2 text-sm" />;
}
