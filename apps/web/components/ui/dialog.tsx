"use client";

import { useEffect, useId, useRef } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="w-full bg-board p-5 text-ink shadow-pop max-md:m-0 max-md:mt-auto max-md:rounded-t-panel md:max-w-[480px] md:rounded-panel"
    >
      <h2 id={titleId} className="text-xl font-extrabold">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </dialog>
  );
}
