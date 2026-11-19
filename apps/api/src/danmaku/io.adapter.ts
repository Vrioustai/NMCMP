import type { INestApplication } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import type { ServerOptions } from "socket.io";

type AllowRequest = NonNullable<ServerOptions["allowRequest"]>;

// Chỉ gateway nhận CORS. REST không bật, vì trang và API đi cùng nguồn sau proxy.
export class FilmgenzIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly webOrigin: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const allowRequest: AllowRequest = (request, callback) => {
      const header = request.headers.origin;
      const origin = Array.isArray(header) ? header[0] : header;
      if (origin === this.webOrigin) callback(null, true);
      else callback("Origin không được phép", false);
    };
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.webOrigin, credentials: true },
      allowRequest,
    });
  }
}
