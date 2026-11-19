import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import {
  accessLogMiddleware,
  RequestLogInterceptor,
} from "./common/interceptors/request-log.interceptor";
import { originGuard } from "./common/origin";
import { validationException } from "./common/validation";
import type { ApiEnv } from "./config/env.schema";
import { FilmgenzIoAdapter } from "./danmaku/io.adapter";
import { createMediaHandler, MediaStorage } from "./media/media-storage";

export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<ApiEnv, true>);
  const media = app.get(MediaStorage);
  app.use(accessLogMiddleware());
  app.use(helmet());
  app.use(cookieParser());
  app.use(originGuard(config.getOrThrow("WEB_ORIGIN")));
  app.useWebSocketAdapter(new FilmgenzIoAdapter(app, config.getOrThrow("WEB_ORIGIN")));
  app.setGlobalPrefix("api");
  // /media nằm trên Express, ngoài tiền tố /api, vì trang web viết lại cả hai đường.
  app.use("/media", createMediaHandler(media));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestLogInterceptor());
}

export async function startApi(): Promise<void> {
  try {
    const app = await NestFactory.create(AppModule);
    configureApp(app);
    app.enableShutdownHooks();
    const config = app.get(ConfigService<ApiEnv, true>);
    await app.listen(config.getOrThrow("API_PORT"));
  } catch (error) {
    process.stderr.write(`${bootError(error)}\n`);
    process.exit(1);
  }
}

function bootError(error: unknown): string {
  const messages: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    messages.push(current.message);
    current = current.cause;
  }
  const text = messages
    .filter((message) => !message.includes("postgresql://") && !message.includes("redis://"))
    .join("\n")
    .trim();
  return text || "API không khởi động được.";
}

const entryName = path.basename(process.argv[1] ?? "");
if (entryName === "main.js" || entryName === "main.ts") {
  void startApi();
}
