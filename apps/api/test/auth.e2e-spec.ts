import { type INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";
import { liveDatabaseUrl } from "./setup-e2e";

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

describe("Auth", () => {
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

  it("registers a user, stores an argon2id hash, and sets the session cookie", async () => {
    const email = `moi-${Date.now()}@filmgenz.test`;
    const response = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Người Mới",
      birthYear: 2000,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email,
      displayName: "Người Mới",
      birthYear: 2000,
      role: "USER",
      avatarUrl: null,
    });
    expect(response.body).not.toHaveProperty("passwordHash");
    const cookie = cookieLines(response).join("\n");
    expect(cookie).toContain("fgz_session=");
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie.toLowerCase()).not.toContain("domain=");

    const stored = await app.get(PrismaService).user.findUnique({ where: { email } });
    expect(stored?.passwordHash.startsWith("$argon2id$")).toBe(true);
    if (liveDatabaseUrl && liveDatabaseUrl !== process.env.DATABASE_URL) {
      const live = new PrismaClient({ datasourceUrl: liveDatabaseUrl });
      try {
        expect(await live.user.findUnique({ where: { email }, select: { id: true } })).toBeNull();
      } finally {
        await live.$disconnect();
      }
    }
  });

  it("rejects a second registration of the same email", async () => {
    const email = `trung-${Date.now()}@filmgenz.test`;
    const body = { email, password: PASSWORD, displayName: "Trùng", birthYear: 2001 };
    expect((await request(app.getHttpServer()).post("/api/auth/register").send(body)).status).toBe(
      201,
    );
    const again = await request(app.getHttpServer()).post("/api/auth/register").send(body);
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ error: { code: "EMAIL_TAKEN" } });
  });

  it("lets one of two simultaneous registrations win", async () => {
    const email = `song-song-${Date.now()}@filmgenz.test`;
    const body = { email, password: PASSWORD, displayName: "Song Song", birthYear: 2002 };
    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post("/api/auth/register").send(body),
      request(app.getHttpServer()).post("/api/auth/register").send(body),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const count = await app.get(PrismaService).user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("logs in and rejects a wrong password with the same message as an unknown email", async () => {
    const email = `vao-${Date.now()}@filmgenz.test`;
    await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Vào",
      birthYear: 1999,
    });
    const logged = await request(app.getHttpServer()).post("/api/auth/login").send({
      email: email.toUpperCase(),
      password: PASSWORD,
    });
    expect(logged.status).toBe(200);
    expect(logged.body.displayName).toBe("Vào");

    const lines: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      lines.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    let wrong: request.Response;
    let unknown: request.Response;
    try {
      wrong = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email, password: "SaiMatKhau1" });
      unknown = await request(app.getHttpServer())
        .post("/api/auth/login")
        .send({ email: "khong-co@filmgenz.test", password: "SaiMatKhau1" });
    } finally {
      process.stdout.write = write;
    }
    expect(wrong.status).toBe(unknown.status);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body).toMatchObject({ error: { code: "INVALID_CREDENTIALS" } });
    const log = lines.join("\n");
    expect(log).not.toContain(email);
    expect(log).not.toContain("SaiMatKhau1");
  });

  it("rejects a locked account and an old cookie after the password hash changes", async () => {
    const email = `khoa-${Date.now()}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Khóa",
      birthYear: 1998,
    });
    const cookie = sessionCookie(registered);
    const prisma = app.get(PrismaService);
    await prisma.user.update({ where: { email }, data: { status: "LOCKED" } });

    const locked = await request(app.getHttpServer()).post("/api/auth/login").send({
      email,
      password: PASSWORD,
    });
    expect(locked.status).toBe(403);
    expect(locked.body).toMatchObject({ error: { code: "ACCOUNT_LOCKED" } });

    await prisma.user.update({ where: { email }, data: { status: "ACTIVE" } });
    const fresh = await request(app.getHttpServer()).post("/api/auth/login").send({
      email,
      password: PASSWORD,
    });
    const freshCookie = sessionCookie(fresh);
    const allowed = await request(app.getHttpServer())
      .get("/api/admin/access")
      .set("Cookie", freshCookie);
    expect(allowed.status).toBe(403);

    await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
    const admin = await request(app.getHttpServer())
      .get("/api/admin/access")
      .set("Cookie", freshCookie);
    expect(admin.status).toBe(200);

    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: `${(await prisma.user.findUnique({ where: { email } }))?.passwordHash}x`,
      },
    });
    const stale = await request(app.getHttpServer())
      .get("/api/admin/access")
      .set("Cookie", freshCookie);
    expect(stale.status).toBe(401);
    expect(stale.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(cookie.length).toBeGreaterThan("fgz_session=".length);
  });

  it("clears the cookie on logout and then requires a session", async () => {
    const email = `ra-${Date.now()}@filmgenz.test`;
    const registered = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Ra",
      birthYear: 1997,
    });
    const loggedOut = await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("Cookie", sessionCookie(registered));
    expect(loggedOut.status).toBe(204);
    const cleared = cookieLines(loggedOut).join("\n");
    expect(cleared).toContain("fgz_session=");
    expect(cleared.toLowerCase()).toMatch(/expires=|max-age=0/);

    const after = await request(app.getHttpServer()).get("/api/admin/access");
    expect(after.status).toBe(401);
    expect(after.body).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  });
});
