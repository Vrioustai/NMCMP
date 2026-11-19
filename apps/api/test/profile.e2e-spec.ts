import { AVATAR_URLS } from "@movie/contracts";
import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";

function cookieLines(response: request.Response): string[] {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function sessionCookie(response: request.Response): string {
  const line = cookieLines(response).find((item) => item.startsWith("fgz_session="));
  return line?.split(";")[0] ?? "";
}

describe("Profile", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(label: string): Promise<{ email: string; cookie: string }> {
    const email = `${label}-${Date.now()}@filmgenz.test`;
    const response = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Tên Cũ",
      birthYear: 2004,
    });
    expect(response.status).toBe(201);
    return { email, cookie: sessionCookie(response) };
  }

  it("TEST_UC04_01 updates the display name and avatar, and a later read returns both", async () => {
    const { email, cookie } = await register("ho-so");
    const before = await request(app.getHttpServer()).get("/api/me").set("Cookie", cookie);
    expect(before.status).toBe(200);
    expect(before.body).toMatchObject({
      email,
      displayName: "Tên Cũ",
      avatarUrl: null,
      birthYear: 2004,
      role: "USER",
    });
    expect(before.body).not.toHaveProperty("passwordHash");

    const renamed = await request(app.getHttpServer())
      .patch("/api/me")
      .set("Cookie", cookie)
      .send({ displayName: "  Tên Mới  " });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({
      displayName: "Tên Mới",
      avatarUrl: null,
      birthYear: 2004,
    });

    const pictured = await request(app.getHttpServer())
      .patch("/api/me")
      .set("Cookie", cookie)
      .send({ avatarUrl: AVATAR_URLS[2] });
    expect(pictured.status).toBe(200);
    expect(pictured.body).toMatchObject({
      displayName: "Tên Mới",
      avatarUrl: AVATAR_URLS[2],
      email,
      birthYear: 2004,
    });

    const again = await request(app.getHttpServer()).get("/api/me").set("Cookie", cookie);
    expect(again.body).toMatchObject({ displayName: "Tên Mới", avatarUrl: AVATAR_URLS[2] });

    const cleared = await request(app.getHttpServer())
      .patch("/api/me")
      .set("Cookie", cookie)
      .send({ avatarUrl: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ displayName: "Tên Mới", avatarUrl: null });

    const stored = await app.get(PrismaService).user.findUnique({ where: { email } });
    expect(stored?.displayName).toBe("Tên Mới");
    expect(stored?.avatarUrl).toBeNull();
    expect(stored?.birthYear).toBe(2004);
  });

  it("rejects birthYear, email, and role without changing the profile", async () => {
    const { email, cookie } = await register("nam-sinh");
    for (const body of [
      { birthYear: 1990, displayName: "Không Đổi" },
      { email: "khac@filmgenz.test", displayName: "Không Đổi" },
      { role: "ADMIN", displayName: "Không Đổi" },
    ]) {
      const response = await request(app.getHttpServer())
        .patch("/api/me")
        .set("Cookie", cookie)
        .send(body);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          code: "VALIDATION_FAILED",
          details: [{ field: Object.keys(body)[0], message: "Không được gửi trường này" }],
        },
      });
    }
    const stored = await app.get(PrismaService).user.findUnique({ where: { email } });
    expect(stored?.displayName).toBe("Tên Cũ");
    expect(stored?.email).toBe(email);
    expect(stored?.birthYear).toBe(2004);
    expect(stored?.role).toBe("USER");
  });

  it("rejects an avatar outside the prepared list", async () => {
    const { email, cookie } = await register("anh");
    const response = await request(app.getHttpServer())
      .patch("/api/me")
      .set("Cookie", cookie)
      .send({ avatarUrl: "/avatars/avatar-99.webp" });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_FAILED",
        details: [{ field: "avatarUrl", message: "Ảnh đại diện không có trong danh sách" }],
      },
    });
    const stored = await app.get(PrismaService).user.findUnique({ where: { email } });
    expect(stored?.avatarUrl).toBeNull();
  });

  it("requires a session", async () => {
    const read = await request(app.getHttpServer()).get("/api/me");
    const write = await request(app.getHttpServer())
      .patch("/api/me")
      .send({ displayName: "Khách" });
    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
    expect(read.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });
});
