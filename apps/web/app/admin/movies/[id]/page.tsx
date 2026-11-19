import { MovieEditor } from "../../../../components/admin/movie-editor";

export const metadata = { title: "Sửa phim" };

export default async function EditMoviePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MovieEditor movieId={id} />;
}
