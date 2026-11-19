import Image from "next/image";
import Link from "next/link";

export function Logo({
  className = "h-8",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link href="/" className={`inline-flex shrink-0 ${className}`}>
      <Image
        src="/logo.png"
        alt="FilmGenZ"
        width={292}
        height={146}
        priority={priority}
        className="h-full w-auto"
      />
    </Link>
  );
}
