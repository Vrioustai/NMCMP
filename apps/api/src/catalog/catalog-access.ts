import { AGE_GATE_MIN_AGE, AGE_GATE_RATING } from "@movie/contracts";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../common/app-error";

type MovieReader = Pick<PrismaClient, "movie">;
type DanmakuReader = Pick<PrismaClient, "danmaku">;

// Mọi API nhận mã phim hoặc Danmaku dùng chung hai hàm này.
// Phim nháp và bình luận đã ẩn đều trả không tìm thấy, kể cả với quản trị viên.
export async function requirePublishedMovie<T extends MovieReader>(
  prisma: T,
  where: { id: number } | { slug: string },
) {
  const movie = await prisma.movie.findFirst({ where: { ...where, status: "PUBLISHED" } });
  if (!movie) throw new AppError("NOT_FOUND");
  return movie;
}

export async function requireVisibleDanmaku<T extends DanmakuReader>(prisma: T, id: number) {
  const danmaku = await prisma.danmaku.findFirst({
    where: {
      id,
      isHidden: false,
      deletedAt: null,
      episode: { movie: { status: "PUBLISHED" } },
    },
  });
  if (!danmaku) throw new AppError("NOT_FOUND");
  return danmaku;
}

type WatchViewer = { birthYear: number; year: number };

// FR16: chặn ở API phát, không chỉ ẩn nút, vì gọi thẳng API vẫn được.
// Phim nháp được xét trước tuổi, để người dưới 18 không biết phim đó tồn tại.
export async function requireWatchableEpisode(
  prisma: Pick<PrismaClient, "episode">,
  episodeId: number,
  viewer: WatchViewer,
) {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      movie: { select: { status: true, ageRating: true, slug: true } },
      subtitles: {
        orderBy: { language: "asc" },
        select: { language: true, url: true },
      },
    },
  });
  if (!episode || episode.movie.status !== "PUBLISHED") throw new AppError("NOT_FOUND");
  if (underAgeGate(episode.movie.ageRating, viewer.birthYear, viewer.year)) {
    throw new AppError("AGE_RESTRICTED");
  }
  return episode;
}

export function underAgeGate(ageRating: string, birthYear: number, year: number): boolean {
  return ageRating === AGE_GATE_RATING && year - birthYear < AGE_GATE_MIN_AGE;
}
