import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { resetDatabase } from "./reset-db";

// Không có .env trên CI; DATABASE_URL_TEST đã được gán sẵn trong môi trường.
if (existsSync(".env")) loadEnvFile();

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) {
  throw new Error("Thiếu DATABASE_URL_TEST.");
}

// Nest và Prisma trong bài kiểm đọc DATABASE_URL. Gán sang DB test trước khi app
// khởi động, nếu không bài kiểm ghi đè dữ liệu của API đang chạy ở máy này.
export const liveDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

// Một lần mỗi file. Xóa trước từng bài sẽ mất tài khoản tạo ở beforeAll.
beforeAll(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});
