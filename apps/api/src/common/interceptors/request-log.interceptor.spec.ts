import { type CallHandler, type ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";
import { AppError } from "../app-error";
import { RequestLogInterceptor } from "./request-log.interceptor";

function context(req: object, statusCode = 200) {
  const res = { statusCode };
  return {
    res,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as unknown as ExecutionContext,
  };
}

describe("RequestLogInterceptor", () => {
  const interceptor = new RequestLogInterceptor();
  let write: jest.Spied<typeof process.stdout.write>;
  const lines: string[] = [];

  beforeEach(() => {
    lines.length = 0;
    write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
  });

  afterEach(() => write.mockRestore());

  it("writes one JSON line and leaves out the query, cookie, and body", async () => {
    const { ctx } = context({
      method: "GET",
      originalUrl: "/api/movies?email=a@b.c",
      headers: { cookie: "fgz_session=abc" },
      body: { password: "hunter2" },
      user: { id: 7 },
    });
    await lastValueFrom(interceptor.intercept(ctx, { handle: () => of({ ok: true }) }));
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]) as {
      method: string;
      path: string;
      status: number;
      userId: number | null;
    };
    expect(entry).toMatchObject({ method: "GET", path: "/api/movies", status: 200, userId: 7 });
    expect(lines[0]).not.toContain("a@b.c");
    expect(lines[0]).not.toContain("fgz_session");
    expect(lines[0]).not.toContain("hunter2");
    expect(entry).not.toHaveProperty("body");
  });

  it("records the error status and still rethrows", async () => {
    const { ctx } = context({ method: "POST", url: "/api/movies" });
    const handler: CallHandler = { handle: () => throwError(() => new AppError("FORBIDDEN")) };
    await expect(lastValueFrom(interceptor.intercept(ctx, handler))).rejects.toBeInstanceOf(
      AppError,
    );
    expect(JSON.parse(lines[0])).toMatchObject({
      method: "POST",
      path: "/api/movies",
      status: 403,
      userId: null,
    });
  });

  it("skips GET /health", async () => {
    const { ctx } = context({ method: "GET", originalUrl: "/api/health" });
    await lastValueFrom(interceptor.intercept(ctx, { handle: () => of({ status: "ok" }) }));
    expect(lines).toHaveLength(0);
  });
});
