import { Logger } from "@nestjs/common";
import { MailService } from "./mail.service";

const sent: { to: string; subject: string; text: string; html: string }[] = [];
let failSend = false;

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: jest.fn(async (message: (typeof sent)[number]) => {
        if (failSend) throw new Error("SMTP refused nguoi@mail.com");
        sent.push(message);
      }),
      close: jest.fn(),
    })),
  },
}));

function service(): MailService {
  const values: Record<string, unknown> = {
    MAIL_FROM: "FilmGenZ <no-reply@filmgenz.local>",
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
  };
  return new MailService({
    getOrThrow: (key: string) => {
      if (!(key in values) || values[key] === undefined) throw new Error(key);
      return values[key];
    },
    get: (key: string) => values[key],
  } as never);
}

describe("MailService", () => {
  beforeEach(() => {
    sent.length = 0;
    failSend = false;
  });

  it("sends the reset link after the caller continues", async () => {
    const mail = service();
    const nodemailer = jest.requireMock("nodemailer") as {
      default: { createTransport: jest.Mock };
    };
    mail.sendPasswordReset("nguoi@mail.com", "http://localhost:3000/reset-password?token=abc");
    expect(sent).toHaveLength(0);
    await mail.whenIdle();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: "FilmGenZ <no-reply@filmgenz.local>",
      to: "nguoi@mail.com",
      subject: "Đặt lại mật khẩu FilmGenZ",
    });
    expect(sent[0]?.text).toContain("http://localhost:3000/reset-password?token=abc");
    expect(sent[0]?.text).not.toContain("matkhau");
    expect(nodemailer.default.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "localhost",
        port: 1025,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 5000,
      }),
    );
    await mail.onModuleDestroy();
  });

  it("escapes the link in the html part", async () => {
    const mail = service();
    mail.sendPasswordReset("nguoi@mail.com", 'http://localhost/reset-password?token=a&b="');
    await mail.whenIdle();
    expect(sent[0]?.html).toContain("token=a&amp;b=&quot;");
    expect(sent[0]?.html).not.toContain('b="');
  });

  it("logs a warning without the address when SMTP fails", async () => {
    failSend = true;
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const mail = service();
    mail.sendPasswordReset("nguoi@mail.com", "http://localhost/reset-password?token=abc");
    await mail.whenIdle();
    expect(warn).toHaveBeenCalledWith("Không gửi được email đặt lại mật khẩu");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("nguoi@mail.com");
    warn.mockRestore();
  });
});
