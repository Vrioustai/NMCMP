"use client";

import { formatDuration } from "../../lib/format";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

export function ResumeDialog({
  open,
  atSec,
  onResume,
  onStart,
}: {
  open: boolean;
  atSec: number;
  onResume: () => void;
  onStart: () => void;
}) {
  return (
    <Dialog open={open} title={`Xem tiếp từ ${formatDuration(atSec)}?`} onClose={onStart}>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onResume}>Xem tiếp</Button>
        <Button variant="secondary" onClick={onStart}>
          Từ đầu
        </Button>
      </div>
    </Dialog>
  );
}
