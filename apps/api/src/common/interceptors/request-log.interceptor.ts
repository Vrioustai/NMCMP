import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { catchError, tap, throwError, type Observable } from "rxjs";
import { describeError } from "../filters/all-exceptions.filter";

export type AccessLog = {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  userId: number | null;
};

type RequestLogSource = {
  method?: string;
  originalUrl?: string;
  url?: string;
  user?: { id?: unknown };
};

type ResponseWithLocals = {
  statusCode?: number;
  locals?: { accessLogged?: boolean };
  on?(event: "finish", listener: () => void): void;
};

export function markAccessLogged(res: ResponseWithLocals): void {
  if (!res.locals) res.locals = {};
  res.locals.accessLogged = true;
}

// Bộ lọc của route không khớp không đi qua interceptor, nên middleware này ghi nốt
// những request chưa được ghi, gồm cả /media.
export function accessLogMiddleware() {
  return (req: RequestLogSource, res: ResponseWithLocals, next: () => void): void => {
    const started = Date.now();
    res.on?.("finish", () => {
      if (res.locals?.accessLogged) return;
      const method = req.method ?? "GET";
      const path = requestPath(req.originalUrl ?? req.url);
      if (isHealthRequest(method, path)) return;
      writeAccessLog({
        method,
        path,
        status: res.statusCode || 200,
        durationMs: Math.max(0, Date.now() - started),
        userId: requestUserId(req),
      });
    });
    next();
  };
}

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestLogSource>();
    const res = http.getResponse<ResponseWithLocals>();
    const method = req.method ?? "GET";
    const path = requestPath(req.originalUrl ?? req.url);
    if (isHealthRequest(method, path)) return next.handle();

    const started = Date.now();
    const userId = requestUserId(req);
    const write = (status: number) => {
      markAccessLogged(res);
      writeAccessLog({
        method,
        path,
        status,
        durationMs: Math.max(0, Date.now() - started),
        userId,
      });
    };

    return next.handle().pipe(
      tap(() => write(res.statusCode || 200)),
      catchError((error: unknown) => {
        write(describeError(error).status);
        return throwError(() => error);
      }),
    );
  }
}

export function writeAccessLog(entry: AccessLog): void {
  // Logger của Nest thêm tiền tố, trong khi hợp đồng là đúng một dòng JSON.
  const line: AccessLog = {
    method: entry.method,
    path: entry.path,
    status: entry.status,
    durationMs: entry.durationMs,
    userId: entry.userId,
  };
  process.stdout.write(`${JSON.stringify(line)}\n`);
}

export function requestPath(url: string | undefined): string {
  const pathOnly = (url ?? "").split("?")[0] ?? "";
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) return pathOnly.slice(0, -1);
  return pathOnly;
}

export function isHealthRequest(method: string, path: string): boolean {
  return method === "GET" && (path === "/api/health" || path === "/health");
}

export function requestUserId(req: { user?: { id?: unknown } }): number | null {
  return typeof req.user?.id === "number" ? req.user.id : null;
}
