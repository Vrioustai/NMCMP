export type AgeRating = "P" | "K" | "T13" | "T16" | "T18";

const TONE: Record<AgeRating, string> = {
  P: "bg-age-p text-on-accent",
  K: "bg-age-k text-ink",
  T13: "bg-age-t13 text-on-accent",
  T16: "bg-age-t16 text-on-accent",
  T18: "bg-age-t18 text-ink",
};

export function AgeBadge({ rating }: { rating: AgeRating }) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-chip px-2 text-[12px] font-bold ${TONE[rating]}`}
    >
      {rating}
    </span>
  );
}
