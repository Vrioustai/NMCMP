export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-chip bg-raised px-2 text-[13px] text-muted">
      {children}
    </span>
  );
}
