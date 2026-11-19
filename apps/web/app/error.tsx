"use client";

import { ErrorState } from "../components/ui/error-state";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <ErrorState title="Có lỗi xảy ra, vui lòng thử lại" onRetry={reset} />
    </main>
  );
}
