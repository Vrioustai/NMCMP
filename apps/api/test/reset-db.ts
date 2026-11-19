import { PrismaClient } from "@prisma/client";

const TABLES = [
  "reports",
  "danmakus",
  "comments",
  "ratings",
  "favorites",
  "watch_histories",
  "subtitles",
  "episodes",
  "movie_credits",
  "movie_genres",
  "movie_countries",
  "banned_words",
  "password_reset_tokens",
  "movies",
  "people",
  "genres",
  "countries",
  "users",
] as const;

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}
