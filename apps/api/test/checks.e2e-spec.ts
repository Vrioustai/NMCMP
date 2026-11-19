import { loadEnvFile } from "node:process";
import { Prisma, PrismaClient } from "@prisma/client";

try {
  loadEnvFile();
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code !== "ENOENT") throw error;
}

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) {
  throw new Error("Thiếu DATABASE_URL_TEST.");
}

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

async function expectCheck(run: () => Promise<unknown>, constraint: string) {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  const meta =
    typeof caught === "object" && caught !== null && "meta" in caught
      ? (caught as { meta?: { code?: string; message?: string } }).meta
      : undefined;
  const message = `${caught instanceof Error ? caught.message : ""} ${meta?.message ?? ""}`;
  expect(meta?.code).toBe("23514");
  expect(message).toContain(constraint);
}

async function insertUser(tx: Prisma.TransactionClient, email: string, birthYear: number) {
  const rows = await tx.$queryRaw<{ id_user: number }[]>`
    INSERT INTO users (email, password_hash, display_name, birth_year, role, status, updated_at)
    VALUES (${email}, 'hash', 'Người thử', ${birthYear}, 'USER'::role, 'ACTIVE'::user_status, NOW())
    RETURNING id_user
  `;
  return rows[0].id_user;
}

async function insertMovie(tx: Prisma.TransactionClient, slug: string, releaseYear: number) {
  const rows = await tx.$queryRaw<{ id_movie: number }[]>`
    INSERT INTO movies (slug, title, description, type, release_year, age_rating, status, updated_at)
    VALUES (
      ${slug},
      'Phim thử',
      'Mô tả',
      'MOVIE'::movie_type,
      ${releaseYear},
      'P'::age_rating,
      'DRAFT'::movie_status,
      NOW()
    )
    RETURNING id_movie
  `;
  return rows[0].id_movie;
}

async function insertEpisode(tx: Prisma.TransactionClient, movieId: number, number: number) {
  const rows = await tx.$queryRaw<{ id_episode: number }[]>`
    INSERT INTO episodes (movie_id, season_number, number)
    VALUES (${movieId}, 1, ${number})
    RETURNING id_episode
  `;
  return rows[0].id_episode;
}

describe("ràng buộc CHECK", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("users_birth_year_check từ chối năm sinh ngoài 1900–2100", async () => {
    await expectCheck(
      () => prisma.$transaction((tx) => insertUser(tx, "birth@example.com", 1800)),
      "users_birth_year_check",
    );
  });

  it("movies_release_year_check từ chối năm phát hành ngoài 1900–2100", async () => {
    await expectCheck(
      () => prisma.$transaction((tx) => insertMovie(tx, "nam-sai", 1800)),
      "movies_release_year_check",
    );
  });

  it("episodes_number_check từ chối số tập nhỏ hơn 1", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const movieId = await insertMovie(tx, "tap-sai", 2024);
          await insertEpisode(tx, movieId, 0);
        }),
      "episodes_number_check",
    );
  });

  it("episodes_duration_check từ chối thời lượng bằng 0", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const movieId = await insertMovie(tx, "thoi-luong-sai", 2024);
          const episodeId = await insertEpisode(tx, movieId, 1);
          await tx.$executeRaw`
            UPDATE episodes SET duration_sec = 0 WHERE id_episode = ${episodeId}
          `;
        }),
      "episodes_duration_check",
    );
  });

  it("watch_histories_progress_check từ chối tiến độ âm", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const userId = await insertUser(tx, "xem@example.com", 2000);
          const movieId = await insertMovie(tx, "xem-sai", 2024);
          const episodeId = await insertEpisode(tx, movieId, 1);
          await tx.$executeRaw`
            INSERT INTO watch_histories (user_id, episode_id, progress_sec, updated_at)
            VALUES (${userId}, ${episodeId}, ${-1}, NOW())
          `;
        }),
      "watch_histories_progress_check",
    );
  });

  it("danmakus_time_check từ chối mốc thời gian âm", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const userId = await insertUser(tx, "moc@example.com", 2000);
          const movieId = await insertMovie(tx, "moc-sai", 2024);
          const episodeId = await insertEpisode(tx, movieId, 1);
          await tx.$executeRaw`
            INSERT INTO danmakus (episode_id, user_id, content, time_ms)
            VALUES (${episodeId}, ${userId}, 'xin chào', ${-1})
          `;
        }),
      "danmakus_time_check",
    );
  });

  it("danmakus_content_check từ chối nội dung trống", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const userId = await insertUser(tx, "noi-dung@example.com", 2000);
          const movieId = await insertMovie(tx, "noi-dung-sai", 2024);
          const episodeId = await insertEpisode(tx, movieId, 1);
          await tx.$executeRaw`
            INSERT INTO danmakus (episode_id, user_id, content, time_ms)
            VALUES (${episodeId}, ${userId}, '   ', 0)
          `;
        }),
      "danmakus_content_check",
    );
  });

  it("comments_content_check từ chối bình luận trống", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const userId = await insertUser(tx, "binh-luan@example.com", 2000);
          const movieId = await insertMovie(tx, "binh-luan-sai", 2024);
          await tx.$executeRaw`
            INSERT INTO comments (movie_id, user_id, content)
            VALUES (${movieId}, ${userId}, '   ')
          `;
        }),
      "comments_content_check",
    );
  });

  it("ratings_score_check từ chối điểm ngoài 1–5", async () => {
    await expectCheck(
      () =>
        prisma.$transaction(async (tx) => {
          const userId = await insertUser(tx, "diem@example.com", 2000);
          const movieId = await insertMovie(tx, "diem-sai", 2024);
          await tx.$executeRaw`
            INSERT INTO ratings (user_id, movie_id, score, updated_at)
            VALUES (${userId}, ${movieId}, ${0}, NOW())
          `;
        }),
      "ratings_score_check",
    );
  });
});
