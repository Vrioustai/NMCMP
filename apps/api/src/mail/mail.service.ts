import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import type { ApiEnv } from "../config/env.schema";
import { passwordResetMail, type OutboundMail } from "./password-reset.mail";

const SMTP_TIMEOUT_MS = 5_000;

type MailTransport = {
  sendMail(message: OutboundMail): Promise<unknown>;
  close(): void;
};

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly transport: MailTransport;
  private pending: Promise<void> = Promise.resolve();

  constructor(config: ConfigService<ApiEnv, true>) {
    this.from = config.getOrThrow("MAIL_FROM");
    const user = config.get("SMTP_USER");
    const pass = config.get("SMTP_PASS");
    this.transport = nodemailer.createTransport({
      host: config.getOrThrow("SMTP_HOST"),
      port: config.getOrThrow("SMTP_PORT"),
      auth: user && pass ? { user, pass } : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }

  sendPasswordReset(to: string, link: string): void {
    const message = passwordResetMail(this.from, to, link);
    // Một lần gửi lỗi không được chặn các email xếp sau.
    this.pending = this.pending.then(
      () => this.deliver(message),
      () => this.deliver(message),
    );
  }

  whenIdle(): Promise<void> {
    return this.pending;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pending;
    this.transport.close();
  }

  private async deliver(message: OutboundMail): Promise<void> {
    try {
      await this.transport.sendMail(message);
    } catch {
      // Thông báo lỗi của SMTP thường kèm địa chỉ người nhận, nên chỉ ghi một câu cố định.
      this.logger.warn("Không gửi được email đặt lại mật khẩu");
    }
  }
}
