import { type ArgumentsHost, BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AppError, ERROR_STATUS, type ErrorCode } from "../app-error";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function host() {
  const response = { statusCode: 0, body: undefined as unknown };
  const http = {
    status(code: number) {
      response.statusCode = code;
      return this;
    },
    json(body: unknown) {
      response.body = body;
    },
  };
  return {
    response,
    host: {
      switchToHttp: () => ({ getResponse: () => http, getRequest: () => ({}) }),
    } as unknown as ArgumentsHost,
  };
}

function prismaError(code: string, meta: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError("SELECT secret_password FROM users", {
    code,
    clientVersion: "test",
    meta,
  });
}

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();
  let warn: jest.Spied<Logger["warn"]>;
  let error: jest.Spied<Logger["error"]>;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it.each(Object.entries(ERROR_STATUS) as [ErrorCode, number][])(
    "maps %s to HTTP %s",
    (code, status) => {
      const { host: http, response } = host();
      const details =
        code === "VALIDATION_FAILED" ? [{ field: "email", message: "sai" }] : undefined;
      filter.catch(new AppError(code, undefined, details), http);
      expect(response.statusCode).toBe(status);
      expect(response.body).toMatchObject({ error: { code } });
      if (details) expect(response.body).toMatchObject({ error: { details } });
    },
  );

  it("hides the database message on an unknown failure", () => {
    const { host: http, response } = host();
    filter.catch(new Error("SELECT secret_password FROM users"), http);
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("SELECT");
    expect(JSON.stringify(response.body)).not.toContain("secret_password");
    expect(response.body).toEqual({
      error: { code: "INTERNAL", message: "Có lỗi xảy ra, vui lòng thử lại" },
    });
    expect(error).toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("maps unique and missing records without returning the query", () => {
    const cases: [string, Record<string, unknown>, number, string][] = [
      ["P2002", { modelName: "User", target: ["email"] }, 409, "EMAIL_TAKEN"],
      ["P2002", { modelName: "Movie", target: ["slug"] }, 409, "SLUG_TAKEN"],
      ["P2002", { modelName: "Genre", target: ["name"] }, 409, "GENRE_TAKEN"],
      ["P2002", { modelName: "BannedWord", target: ["word"] }, 409, "WORD_TAKEN"],
      ["P2002", { modelName: "Report", target: ["userId", "danmakuId"] }, 409, "ALREADY_REPORTED"],
      ["P2003", { constraint: "movie_genres_genre_id_fkey" }, 409, "GENRE_IN_USE"],
      ["P2025", { modelName: "Movie" }, 404, "NOT_FOUND"],
    ];
    for (const [code, meta, status, errorCode] of cases) {
      const { host: http, response } = host();
      filter.catch(prismaError(code, meta), http);
      expect(response.statusCode).toBe(status);
      expect(response.body).toMatchObject({ error: { code: errorCode } });
      expect(JSON.stringify(response.body)).not.toContain("SELECT");
    }
  });

  it("does not warn for 401 or 404, and warns for other client errors", () => {
    const missing = host();
    filter.catch(new NotFoundException(), missing.host);
    expect(missing.response.statusCode).toBe(404);
    expect(missing.response.body).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(warn).not.toHaveBeenCalled();

    const forbidden = host();
    filter.catch(new AppError("FORBIDDEN"), forbidden.host);
    expect(warn).toHaveBeenCalled();

    const bad = host();
    filter.catch(new BadRequestException(["email must be an email"]), bad.host);
    expect(bad.response.body).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
  });
});
