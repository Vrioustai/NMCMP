import type { Genre } from "@movie/contracts";
import { SiteFrame } from "../../components/layout/site-frame";
import { apiServer } from "../../lib/api/server";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  let genres: Genre[] = [];
  try {
    genres = await apiServer<Genre[]>("/genres");
  } catch {
    genres = [];
  }
  return <SiteFrame genres={genres}>{children}</SiteFrame>;
}
