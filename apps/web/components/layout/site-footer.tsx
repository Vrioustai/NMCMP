import type { Genre } from "@movie/contracts";
import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter({ genres }: { genres: Genre[] }) {
  return (
    <footer className="border-t border-line px-4 py-8 md:px-6 lg:px-7">
      <Logo className="h-7" />
      <nav
        aria-label="Thể loại"
        className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-muted"
      >
        {genres.map((genre) => (
          <Link key={genre.id} href={`/search?genre=${genre.id}`}>
            {genre.name}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-[13px] text-dim">© 2026 FilmGenZ</p>
    </footer>
  );
}
