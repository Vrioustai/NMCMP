import { Star } from "lucide-react";
import { formatNumber, formatScore } from "../../lib/format";

export function RatingStars({ average, count }: { average: number | null; count: number }) {
  if (average === null || count === 0) {
    return <p className="text-sm text-muted">Chưa có đánh giá</p>;
  }
  const filled = Math.round(average);
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            size={16}
            className={index < filled ? "fill-accent text-accent" : "text-dim"}
          />
        ))}
      </span>
      <span>{formatScore(average)}</span>
      <span className="text-[13px] text-muted">({formatNumber(count)})</span>
    </p>
  );
}
