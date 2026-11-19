import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

// Danh sách đã chốt ở D1 theo spec 4.3. Tên thư mục trong kho Data
// (action, Drama, Cổ trang, Học đường, Phim review, …) là cách xếp file,
// không phải tên thể loại trong CSDL. "Phim review" không phải thể loại.
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

// Mười từ mẫu. "spamlink" là từ phiếu TEST_UC08_03 dùng.
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

const ADMIN_DISPLAY_NAME = "Quản trị viên";
const ADMIN_BIRTH_YEAR = 2000;

function readSeedEnv(): { email: string; password: string } {
  try {
    loadEnvFile();
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code !== "ENOENT") throw error;
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Thiếu SEED_ADMIN_EMAIL hoặc SEED_ADMIN_PASSWORD. Đặt cả hai trong apps/api/.env rồi chạy lại.",
    );
  }
  return { email, password };
}

async function main() {
  const { email, password } = readSeedEnv();
  const prisma = new PrismaClient();
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash,
        displayName: ADMIN_DISPLAY_NAME,
        birthYear: ADMIN_BIRTH_YEAR,
        role: "ADMIN",
      },
      update: {
        passwordHash,
        displayName: ADMIN_DISPLAY_NAME,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });

    for (const name of GENRES) {
      await prisma.genre.upsert({ where: { name }, create: { name }, update: {} });
    }
    for (const name of COUNTRIES) {
      await prisma.country.upsert({ where: { name }, create: { name }, update: {} });
    }
    for (const word of BANNED_WORDS) {
      await prisma.bannedWord.upsert({
        where: { word },
        create: { word, creatorUserId: admin.id },
        update: {},
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
