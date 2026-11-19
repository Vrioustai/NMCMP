import { Logger } from "@nestjs/common";
import { errorBody } from "./app-error";
import {
  markAccessLogged,
  requestPath,
  requestUserId,
  writeAccessLog,
} from "./interceptors/request-log.interceptor";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type OriginRequest = {
  method: string;
  headers: { origin?: string | string[] };
  originalUrl?: string;
  url?: string;
  user?: { id?: unknown };
};

type OriginResponse = {
  status(code: number): { json(body: unknown): void };
  locals?: { accessLogged?: boolean };
};

type Next = () => void;

// Request không có Origin (test, máy chủ gọi máy chủ) vẫn qua. REST không bật CORS:
// trình duyệt gọi cùng nguồn, nên không cần cho trang khác đọc API.
export function originGuard(webOrigin: string) {
  const logger = new Logger("Origin");
  return (req: OriginRequest, res: OriginResponse, next: Next): void => {
    if (!WRITE_METHODS.has(req.method)) {
      next();
      return;
    }
    const header = req.headers.origin;
    const origin = Array.isArray(header) ? header[0] : header;
    if (!origin || origin === webOrigin) {
      next();
      return;
    }
    markAccessLogged(res);
    writeAccessLog({
      method: req.method,
      path: requestPath(req.originalUrl ?? req.url),
      status: 403,
      durationMs: 0,
      userId: requestUserId(req),
    });
    logger.warn("Từ chối request ghi vì Origin khác trang web.");
    res.status(403).json(errorBody("FORBIDDEN", "Origin không được phép"));
  };
}
