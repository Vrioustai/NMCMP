import { loadEnvFile } from "node:process";
import path from "path";
import { PrismaClient, type AgeRating, type MovieType } from "@prisma/client";
import argon2 from "argon2";
import { AdminAssetsService } from "../../src/admin/admin-assets.service";
import { Clock } from "../../src/common/clock";
import { MediaStorage } from "../../src/media/media-storage";
import type { PrismaService } from "../../src/prisma/prisma.service";

// Mật khẩu chỉ dùng cho CSDL máy cá nhân. Không dùng trên môi trường khác.
const DEV_PASSWORD = "FilmGenzDev1";

const GENRES = [
  "Hành động",
  "Phiêu lưu",
  "Hoạt hình",
  "Hài",
  "Chính kịch",
  "Kinh dị",
  "Khoa học viễn tưởng",
  "Giả tưởng",
  "Tâm lý",
  "Lãng mạn",
  "Gia đình",
  "Tài liệu",
] as const;

const COUNTRIES = [
  "Việt Nam",
  "Hàn Quốc",
  "Nhật Bản",
  "Trung Quốc",
  "Mỹ",
  "Anh",
  "Pháp",
  "Hà Lan",
] as const;

const BANNED_WORDS = [
  "spamlink",
  "spam",
  "scam",
  "casino",
  "betlink",
  "clickbait",
  "quangcao",
  "luadao",
  "cryptoad",
  "freegift",
] as const;

const SUBTITLE = "WEBVTT\n\n00:00:05.000 --> 00:00:08.000\nXin chào\n";
const DAY_MS = 24 * 60 * 60 * 1000;

type EpisodePlan = { number: number; durationSec: number; subtitle?: boolean };

type MoviePlan = {
  slug: string;
  title: string;
  type: MovieType;
  releaseYear: number;
  ageRating: AgeRating;
  genres: string[];
  countries: string[];
  status: "PUBLISHED" | "DRAFT";
  publishedDaysAgo: number | null;
  episodes: EpisodePlan[];
  recentViewers: number;
  oldViewers: number;
};

export async function seedDev(prisma: PrismaClient, mediaDir: string): Promise<void> {
  const now = new Date();
  const year = new Clock(now).year();
  const passwordHash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
  const admin = await upsertUser(prisma, {
    email: "admin@filmgenz.local",
    displayName: "Quản trị viên",
    birthYear: 2000,
    role: "ADMIN",
    status: "ACTIVE",
    passwordHash,
  });
  await upsertUser(prisma, {
    email: "u17@filmgenz.local",
    displayName: "Người 17 tuổi",
    birthYear: year - 17,
    role: "USER",
    status: "ACTIVE",
    passwordHash,
  });
  await upsertUser(prisma, {
    email: "u18@filmgenz.local",
    displayName: "Người 18 tuổi",
    birthYear: year - 18,
    role: "USER",
    status: "ACTIVE",
    passwordHash,
  });
  await upsertUser(prisma, {
    email: "u25@filmgenz.local",
    displayName: "Người 25 tuổi",
    birthYear: year - 25,
    role: "USER",
    status: "ACTIVE",
    passwordHash,
  });
  await upsertUser(prisma, {
    email: "locked@filmgenz.local",
    displayName: "Tài khoản khóa",
    birthYear: 2000,
    role: "USER",
    status: "LOCKED",
    passwordHash,
  });
  const viewers = [];
  for (let index = 1; index <= 15; index += 1) {
    const label = String(index).padStart(2, "0");
    viewers.push(
      await upsertUser(prisma, {
        email: `view-${label}@filmgenz.local`,
        displayName: `Người xem ${label}`,
        birthYear: 2000,
        role: "USER",
        status: "ACTIVE",
        passwordHash,
      }),
    );
  }

  for (const name of GENRES) {
    await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of COUNTRIES) {
    await prisma.country.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const word of BANNED_WORDS) {
    await prisma.bannedWord.upsert({
      where: { word },
      update: {},
      create: { word, creatorUserId: admin.id },
    });
  }

  const plans = catalog();
  const storage = new MediaStorage(mediaDir);
  const assets = new AdminAssetsService(prisma as unknown as PrismaService, storage);
  for (const plan of plans) {
    await writeMovie(
      prisma,
      assets,
      plan,
      now,
      viewers.map((viewer) => viewer.id),
    );
  }
}

async function writeMovie(
  prisma: PrismaClient,
  assets: AdminAssetsService,
  plan: MoviePlan,
  now: Date,
  viewerIds: number[],
): Promise<void> {
  const publishedAt =
    plan.status === "PUBLISHED" && plan.publishedDaysAgo != null
      ? new Date(now.getTime() - plan.publishedDaysAgo * DAY_MS)
      : null;
  const movie = await prisma.movie.upsert({
    where: { slug: plan.slug },
    create: {
      slug: plan.slug,
      title: plan.title,
      description: plan.title,
      type: plan.type,
      releaseYear: plan.releaseYear,
      ageRating: plan.ageRating,
      status: plan.status,
      publishedAt,
      sourceUrl: `https://filmgenz.local/nguon/${plan.slug}`,
      license: "Dữ liệu mẫu trên máy cá nhân",
    },
    update: {
      title: plan.title,
      description: plan.title,
      type: plan.type,
      releaseYear: plan.releaseYear,
      ageRating: plan.ageRating,
      status: plan.status,
      publishedAt,
    },
  });
  const genres = await prisma.genre.findMany({ where: { name: { in: [...plan.genres] } } });
  const countries = await prisma.country.findMany({ where: { name: { in: [...plan.countries] } } });
  await prisma.movieGenre.deleteMany({ where: { movieId: movie.id } });
  await prisma.movieCountry.deleteMany({ where: { movieId: movie.id } });
  await prisma.movieGenre.createMany({
    data: genres.map((genre) => ({ movieId: movie.id, genreId: genre.id })),
  });
  await prisma.movieCountry.createMany({
    data: countries.map((country) => ({ movieId: movie.id, countryId: country.id })),
  });

  const episodeIds: number[] = [];
  for (const episode of plan.episodes) {
    const saved = await prisma.episode.upsert({
      where: {
        movieId_seasonNumber_number: { movieId: movie.id, seasonNumber: 1, number: episode.number },
      },
      create: {
        movieId: movie.id,
        seasonNumber: 1,
        number: episode.number,
        title: plan.type === "SERIES" ? `Tập ${episode.number}` : null,
        streamUid: `dev-${plan.slug}-s1e${episode.number}`,
        durationSec: episode.durationSec,
      },
      update: {
        streamUid: `dev-${plan.slug}-s1e${episode.number}`,
        durationSec: episode.durationSec,
      },
    });
    episodeIds.push(saved.id);
    if (episode.subtitle) {
      const bytes = Buffer.from(SUBTITLE, "utf8");
      await assets.saveSubtitle(saved.id, "vi", { buffer: bytes, size: bytes.length });
    }
  }

  await prisma.report.deleteMany({ where: { danmaku: { episodeId: { in: episodeIds } } } });
  await prisma.danmaku.deleteMany({ where: { episodeId: { in: episodeIds } } });
  await prisma.watchHistory.deleteMany({ where: { episodeId: { in: episodeIds } } });
  const firstEpisode = episodeIds[0];
  if (firstEpisode === undefined) return;
  const recent = viewerIds.slice(0, plan.recentViewers);
  const old = viewerIds.slice(0, plan.oldViewers);
  if (recent.length > 0) {
    await prisma.watchHistory.createMany({
      data: recent.map((userId) => ({
        userId,
        episodeId: firstEpisode,
        progressSec: 10,
        createdAt: new Date(now.getTime() - DAY_MS),
      })),
    });
  }
  for (const userId of old) {
    if (recent.includes(userId)) continue;
    await prisma.watchHistory.create({
      data: {
        userId,
        episodeId: firstEpisode,
        progressSec: 10,
        createdAt: new Date(now.getTime() - 30 * DAY_MS),
      },
    });
  }

  if (plan.slug !== "phim-bo-mau-01") return;
  const reporters = await prisma.user.findMany({
    where: { email: { in: ["u17@filmgenz.local", "u18@filmgenz.local", "u25@filmgenz.local"] } },
    orderBy: { email: "asc" },
  });
  for (let index = 0; index < 3; index += 1) {
    const author = viewerIds[index];
    const reporter = reporters[index];
    if (author === undefined || !reporter) continue;
    const danmaku = await prisma.danmaku.create({
      data: {
        episodeId: firstEpisode,
        userId: author,
        content: `Bình luận mẫu ${index + 1}`,
        timeMs: 5 * 60 * 1000 + 10 * 1000,
      },
    });
    await prisma.report.create({
      data: {
        reporterUserId: reporter.id,
        danmakuId: danmaku.id,
        reason: "Nội dung không phù hợp",
        status: "PENDING",
      },
    });
  }
}

function catalog(): MoviePlan[] {
  const plans: MoviePlan[] = [];
  for (let index = 1; index <= 10; index += 1) {
    const label = String(index).padStart(2, "0");
    plans.push(
      movie({
        slug: `phim-moi-${label}`,
        title: `Phim mới ${label}`,
        publishedDaysAgo: index - 1,
        genres: ["Hài"],
        countries: ["Việt Nam"],
      }),
    );
  }
  for (let index = 1; index <= 10; index += 1) {
    const label = String(index).padStart(2, "0");
    plans.push(
      movie({
        slug: `phim-xu-huong-${label}`,
        title: `Phim xu hướng ${label}`,
        publishedDaysAgo: 19 + index,
        genres: ["Tâm lý"],
        countries: ["Nhật Bản"],
        recentViewers: 16 - index,
      }),
    );
  }
  plans.push(
    movie({
      slug: "phim-bo-mau-01",
      title: "Phim bộ mẫu 01",
      type: "SERIES",
      ageRating: "T16",
      publishedDaysAgo: 10,
      genres: ["Chính kịch"],
      countries: ["Việt Nam"],
      episodes: [
        { number: 1, durationSec: 1200, subtitle: true },
        { number: 2, durationSec: 1200, subtitle: true },
        { number: 3, durationSec: 1200 },
      ],
    }),
    movie({
      slug: "phim-mau-02",
      title: "Phim mẫu 02",
      releaseYear: 2024,
      publishedDaysAgo: 11,
      genres: ["Hành động"],
      countries: ["Hàn Quốc"],
    }),
    movie({
      slug: "phim-nha-03",
      title: "Phim nha 03",
      publishedDaysAgo: 12,
      genres: ["Lãng mạn"],
      countries: ["Việt Nam"],
    }),
    movie({
      slug: "phim-nha-04",
      title: "Phim Nhà 04",
      publishedDaysAgo: 13,
      genres: ["Gia đình"],
      countries: ["Pháp"],
    }),
    movie({
      slug: "phim-tuoi-18",
      title: "Phim tuổi 18",
      ageRating: "T18",
      publishedDaysAgo: 14,
      genres: ["Kinh dị"],
      countries: ["Mỹ"],
    }),
    movie({
      slug: "phim-xem-cu",
      title: "Phim xem cũ",
      publishedDaysAgo: 15,
      genres: ["Tài liệu"],
      countries: ["Anh"],
      oldViewers: 1,
    }),
  );
  const fillers: { genres: string[]; countries: string[] }[] = [
    { genres: ["Phiêu lưu"], countries: ["Trung Quốc"] },
    { genres: ["Hoạt hình"], countries: ["Hà Lan"] },
    { genres: ["Khoa học viễn tưởng"], countries: ["Mỹ"] },
    { genres: ["Giả tưởng"], countries: ["Anh"] },
  ];
  fillers.forEach((filler, index) => {
    const label = String(index + 1).padStart(2, "0");
    plans.push(
      movie({
        slug: `phim-dien-${label}`,
        title: `Phim điền ${label}`,
        publishedDaysAgo: 16 + index,
        genres: filler.genres,
        countries: filler.countries,
      }),
    );
  });
  plans.push(
    movie({
      slug: "phim-nhap-an-01",
      title: "Phim nháp ẩn 01",
      status: "DRAFT",
      publishedDaysAgo: null,
      genres: ["Hài"],
      countries: ["Việt Nam"],
    }),
    movie({
      slug: "phim-nhap-an-02",
      title: "Phim nháp ẩn 02",
      status: "DRAFT",
      publishedDaysAgo: null,
      genres: ["Chính kịch"],
      countries: ["Hàn Quốc"],
    }),
  );
  return plans;
}

function movie(input: Partial<MoviePlan> & Pick<MoviePlan, "slug" | "title">): MoviePlan {
  return {
    type: "MOVIE",
    releaseYear: 2020,
    ageRating: "P",
    genres: ["Hài"],
    countries: ["Việt Nam"],
    status: "PUBLISHED",
    publishedDaysAgo: 0,
    episodes: [{ number: 1, durationSec: 90 }],
    recentViewers: 0,
    oldViewers: 0,
    ...input,
  };
}

async function upsertUser(
  prisma: PrismaClient,
  user: {
    email: string;
    displayName: string;
    birthYear: number;
    role: "USER" | "ADMIN";
    status: "ACTIVE" | "LOCKED";
    passwordHash: string;
  },
): Promise<{ id: number }> {
  return prisma.user.upsert({
    where: { email: user.email },
    create: user,
    update: {
      displayName: user.displayName,
      birthYear: user.birthYear,
      role: user.role,
      status: user.status,
      passwordHash: user.passwordHash,
    },
    select: { id: true },
  });
}

function invokedDirectly(): boolean {
  const entry = process.argv[1]?.replace(/\\/g, "/");
  return entry?.endsWith("prisma/fixtures/dev.ts") === true;
}

if (invokedDirectly()) {
  if (process.env.NODE_ENV === "production") {
    console.error("fixtures/dev.ts từ chối chạy khi NODE_ENV=production.");
    process.exit(1);
  }
  try {
    loadEnvFile();
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
  }
  const prisma = new PrismaClient();
  seedDev(prisma, process.env.MEDIA_DIR?.trim() || path.resolve("uploads"))
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error instanceof Error ? error.message : "Không nạp được dữ liệu dev.");
      await prisma.$disconnect();
      process.exit(1);
    });
}
