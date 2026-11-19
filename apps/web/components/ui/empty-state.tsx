export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-panel border border-line bg-card px-6 py-10 text-center">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {description ? <p className="mt-2 text-[13px] text-muted">{description}</p> : null}
    </div>
  );
}
