import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { Clock } from "../src/common/clock";
import { MailService } from "../src/mail/mail.service";
import { configureApp } from "../src/main";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "MatKhau1";
const NEXT_PASSWORD = "MatKhau2";

type CapturedMail = { to: string; subject: string; text: string; html: string };

type Mailbox = {
  messages: CapturedMail[];
  gate: Promise<void>;
};

const mailbox: Mailbox = { messages: [], gate: Promise.resolve() };
(globalThis as typeof globalThis & { __fgzMail?: Mailbox }).__fgzMail = mailbox;

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: () => ({
      sendMail: async (message: CapturedMail) => {
        const box = (globalThis as typeof globalThis & { __fgzMail?: Mailbox }).__fgzMail;
        if (!box) throw new Error("Thiếu hộp thư giả.");
        box.messages.push(message);
        await box.gate;
      },
      close: () => undefined,
    }),
  },
}));

function cookieLines(response: request.Response): string[] {
  const header = response.headers["set-cookie"] as string | string[] | undefined;
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

function sessionCookie(response: request.Response): string {
  const line = cookieLines(response).find((item) => item.startsWith("fgz_session="));
  return line?.split(";")[0] ?? "";
}

function resetLinkToken(message: CapturedMail): string {
  const found = message.text.match(/https?:\/\/\S+/);
  if (!found?.[0]) throw new Error("Email không có liên kết.");
  const token = new URL(found[0]).searchParams.get("token");
  if (!token) throw new Error("Liên kết không có mã.");
  return token;
}

describe("Password reset", () => {
  let app: INestApplication;
  const now = new Date("2026-06-01T03:00:00.000Z");

  beforeAll(async () => {
    jest.spyOn(Clock, "start").mockImplementation((timeZone?: string) => new Clock(now, timeZone));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    mailbox.messages.length = 0;
    mailbox.gate = Promise.resolve();
    now.setTime(Date.parse("2026-06-01T03:00:00.000Z"));
  });

  async function register(email: string): Promise<string> {
    const response = await request(app.getHttpServer()).post("/api/auth/register").send({
      email,
      password: PASSWORD,
      displayName: "Quên Mật",
      birthYear: 2000,
    });
    expect(response.status).toBe(201);
    return sessionCookie(response);
  }

  it("TEST_UC03_01 resets the password, rejects the link on the second use, and drops the old session", async () => {
    const email = `quen-${Date.now()}@filmgenz.test`;
    const cookie = await register(email);
    const forgot = await request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email });
    expect(forgot.status).toBe(202);
    await app.get(MailService).whenIdle();
    const message = mailbox.messages[0];
    expect(message?.subject).toBe("Đặt lại mật khẩu FilmGenZ");
    expect(message?.text).not.toContain(PASSWORD);
    expect(message?.text).not.toContain(NEXT_PASSWORD);
    const token = resetLinkToken(message ?? { to: "", subject: "", text: "", html: "" });

    const reset = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token, newPassword: NEXT_PASSWORD });
    expect(reset.status).toBe(204);

    const stored = await app.get(PrismaService).passwordResetToken.findFirst({
      where: { user: { email } },
    });
    expect(stored?.usedAt).not.toBeNull();
    expect(stored?.tokenHash).toHaveLength(64);
    expect(stored?.tokenHash).not.toContain(token);

    const oldSession = await request(app.getHttpServer())
      .get("/api/admin/access")
      .set("Cookie", cookie);
    expect(oldSession.status).toBe(401);

    const oldPassword = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });
    expect(oldPassword.status).toBe(401);
    const loggedIn = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email, password: NEXT_PASSWORD });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.displayName).toBe("Quên Mật");

    const again = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token, newPassword: "MatKhau3" });
    expect(again.status).toBe(410);
    expect(again.body).toMatchObject({ error: { code: "RESET_TOKEN_INVALID" } });
  });

  it("A12 returns the same response for a known and an unknown email", async () => {
    const email = `co-${Date.now()}@filmgenz.test`;
    const unknown = `khong-${Date.now()}@filmgenz.test`;
    await register(email);
    const writes: string[] = [];
    const stdout = process.stdout.write.bind(process.stdout);
    const stderr = process.stderr.write.bind(process.stderr);
    const capture = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;
    process.stdout.write = capture;
    process.stderr.write = capture;
    let known: request.Response;
    let missing: request.Response;
    try {
      known = await request(app.getHttpServer()).post("/api/auth/forgot-password").send({ email });
      missing = await request(app.getHttpServer())
        .post("/api/auth/forgot-password")
        .send({ email: unknown });
    } finally {
      process.stdout.write = stdout;
      process.stderr.write = stderr;
    }
    expect(known.status).toBe(202);
    expect(missing.status).toBe(202);
    expect(known.body).toEqual(missing.body);
    expect(known.text).not.toContain(email);
    await app.get(MailService).whenIdle();
    expect(mailbox.messages.map((message) => message.to)).toEqual([email]);
    const log = writes.join("\n");
    expect(log).not.toContain(email);
    expect(log).not.toContain(unknown);
    expect(log).not.toContain(PASSWORD);
  });

  it("answers before SMTP finishes", async () => {
    const email = `nen-${Date.now()}@filmgenz.test`;
    await register(email);
    let release = (): void => undefined;
    mailbox.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const response = await request(app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email });
    expect(response.status).toBe(202);
    release();
    await app.get(MailService).whenIdle();
    expect(mailbox.messages).toHaveLength(1);
  });

  it("rejects a reset link once the clock reaches 30 minutes", async () => {
    const email = `han-${Date.now()}@filmgenz.test`;
    await register(email);
    await request(app.getHttpServer()).post("/api/auth/forgot-password").send({ email });
    await app.get(MailService).whenIdle();
    const token = resetLinkToken(
      mailbox.messages[0] ?? { to: "", subject: "", text: "", html: "" },
    );
    now.setTime(now.getTime() + 30 * 60 * 1000);
    const expired = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token, newPassword: NEXT_PASSWORD });
    expect(expired.status).toBe(410);
    expect(expired.body).toMatchObject({ error: { code: "RESET_TOKEN_INVALID" } });
  });

  it("rejects a new password equal to the current one and still accepts another", async () => {
    const email = `giong-${Date.now()}@filmgenz.test`;
    await register(email);
    await request(app.getHttpServer()).post("/api/auth/forgot-password").send({ email });
    await app.get(MailService).whenIdle();
    const token = resetLinkToken(
      mailbox.messages[0] ?? { to: "", subject: "", text: "", html: "" },
    );
    const same = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token, newPassword: PASSWORD });
    expect(same.status).toBe(400);
    expect(same.body).toMatchObject({
      error: { code: "VALIDATION_FAILED", details: [{ field: "newPassword" }] },
    });
    const changed = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token, newPassword: NEXT_PASSWORD });
    expect(changed.status).toBe(204);
  });

  it("replaces an unused reset link", async () => {
    const email = `thay-${Date.now()}@filmgenz.test`;
    await register(email);
    await request(app.getHttpServer()).post("/api/auth/forgot-password").send({ email });
    await app.get(MailService).whenIdle();
    const first = resetLinkToken(
      mailbox.messages[0] ?? { to: "", subject: "", text: "", html: "" },
    );
    mailbox.messages.length = 0;
    await request(app.getHttpServer()).post("/api/auth/forgot-password").send({ email });
    await app.get(MailService).whenIdle();
    const second = resetLinkToken(
      mailbox.messages[0] ?? { to: "", subject: "", text: "", html: "" },
    );
    const stale = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token: first, newPassword: NEXT_PASSWORD });
    expect(stale.status).toBe(410);
    const fresh = await request(app.getHttpServer())
      .post("/api/auth/reset-password")
      .send({ token: second, newPassword: NEXT_PASSWORD });
    expect(fresh.status).toBe(204);
  });
});
