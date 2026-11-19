export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ok" | "danger";
}) {
  const toneClass = tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-muted";
  return (
    <span
      className={`inline-flex h-6 items-center rounded-chip bg-raised px-2 text-[12px] ${toneClass}`}
    >
      {children}
    </span>
  );
}
