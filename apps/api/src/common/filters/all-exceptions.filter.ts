import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  type ErrorBody,
  type ErrorCode,
  ERROR_STATUS,
  errorBody,
  isErrorBody,
  SERVER_ERROR_BODY,
} from "../app-error";

type DescribedError = { status: number; body: ErrorBody };

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{
      status(code: number): { json(body: unknown): void };
    }>();
    const described = describeError(exception);
    this.log(described, exception);
    response.status(described.status).json(described.body);
  }

  private log(described: DescribedError, exception: unknown): void {
    if (described.status >= 500) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error("Lỗi máy chủ", stack);
      return;
    }
    // 401 và 404 xảy ra liên tục với khách và đường dẫn sai, không ghi để log khỏi ngập.
    if (described.status === 401 || described.status === 404) return;
    this.logger.warn(described.body.error.code);
  }
}

export function describeError(exception: unknown): DescribedError {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    if (isErrorBody(response)) return { status: exception.getStatus(), body: response };
    return describeHttpStatus(exception.getStatus());
  }
  if (isFileTooLarge(exception)) {
    return {
      status: ERROR_STATUS.VALIDATION_FAILED,
      body: errorBody("VALIDATION_FAILED", "Tệp quá lớn"),
    };
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === "P2002") return uniqueConflict(exception.meta);
    if (exception.code === "P2025")
      return { status: ERROR_STATUS.NOT_FOUND, body: errorBody("NOT_FOUND") };
    if (exception.code === "P2003" && mentionsGenre(exception.meta)) {
      return { status: ERROR_STATUS.GENRE_IN_USE, body: errorBody("GENRE_IN_USE") };
    }
  }
  return { status: 500, body: SERVER_ERROR_BODY };
}

function describeHttpStatus(status: number): DescribedError {
  if (status === 400) return { status, body: errorBody("VALIDATION_FAILED") };
  if (status === 401) return { status, body: errorBody("UNAUTHENTICATED") };
  if (status === 403) return { status, body: errorBody("FORBIDDEN") };
  if (status === 404) return { status, body: errorBody("NOT_FOUND") };
  if (status >= 500) return { status: 500, body: SERVER_ERROR_BODY };
  return { status, body: errorBody("VALIDATION_FAILED") };
}

function uniqueConflict(meta: unknown): DescribedError {
  const model = readString(meta, "modelName");
  const target = readTarget(meta).join(" ").toLowerCase();
  const code = uniqueCode(model, target);
  if (!code) {
    return {
      status: 409,
      body: { error: { code: "VALIDATION_FAILED", message: "Dữ liệu đã tồn tại" } },
    };
  }
  return { status: ERROR_STATUS[code], body: errorBody(code) };
}

function uniqueCode(model: string, target: string): ErrorCode | null {
  if (model === "User" || target.includes("email")) return "EMAIL_TAKEN";
  if (model === "Movie" || target.includes("slug")) return "SLUG_TAKEN";
  if (model === "Genre") return "GENRE_TAKEN";
  if (model === "BannedWord" || target.includes("word")) return "WORD_TAKEN";
  if (model === "Report" || target.includes("report")) return "ALREADY_REPORTED";
  return null;
}

function isFileTooLarge(exception: unknown): boolean {
  if (!(exception instanceof Error) || exception.name !== "MulterError") return false;
  return "code" in exception && exception.code === "LIMIT_FILE_SIZE";
}

function mentionsGenre(meta: unknown): boolean {
  return JSON.stringify(meta ?? {})
    .toLowerCase()
    .includes("genre");
}

function readString(meta: unknown, key: string): string {
  if (!meta || typeof meta !== "object") return "";
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function readTarget(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  const target = (meta as { target?: unknown }).target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}
