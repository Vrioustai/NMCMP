import type { MovieCard, Page } from "@movie/contracts";
import { MePager, pageNumber } from "../../../../components/account/me-pager";
import { FavoriteGrid } from "../../../../components/movie/favorite-grid";
import { apiServer } from "../../../../lib/api/server";

export const metadata = { title: "Phim yêu thích" };

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  const data = await apiServer<Page<MovieCard>>(`/me/favorites?page=${page}`, {
    redirectOn401: "/me/favorites",
  });

  return (
    <>
      <h1 className="mb-4 text-2xl font-extrabold">Phim yêu thích</h1>
      <FavoriteGrid movies={data.items} />
      <MePager base="/me/favorites" page={data.page} pageSize={data.pageSize} total={data.total} />
    </>
  );
}
