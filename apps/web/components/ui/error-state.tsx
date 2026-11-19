"use client";

import { Button } from "./button";

export function ErrorState({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <div className="rounded-panel border border-line bg-card px-6 py-10 text-center">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {onRetry ? (
        <Button className="mt-4" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}
