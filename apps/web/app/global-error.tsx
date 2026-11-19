"use client";

import { ErrorState } from "../components/ui/error-state";
import { beVietnam } from "../lib/font";
import "./globals.css";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body className="font-sans">
        <main className="mx-auto max-w-lg px-4 py-16">
          <ErrorState title="Có lỗi xảy ra, vui lòng thử lại" onRetry={reset} />
        </main>
      </body>
    </html>
  );
}
