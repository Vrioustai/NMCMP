import type { UserProfile } from "@movie/contracts";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { requireWatchableEpisode } from "../catalog/catalog-access";
import { AppError } from "../common/app-error";
import { Clock } from "../common/clock";
import { PrismaService } from "../prisma/prisma.service";
import { passwordVersion } from "../auth/password";
import { toProfile } from "../auth/profile";
import { SESSION_COOKIE } from "../auth/session-cookie";
import { AccountStatusService } from "./account-status.service";
import { DanmakuService } from "./danmaku.service";

type ViewerSocket = Socket & {
  data: { user?: UserProfile; episodeId?: number; durationSec?: number | null };
};

type SessionPayload = { sub?: unknown; pv?: unknown };

@WebSocketGateway({ namespace: "/danmaku" })
export class DanmakuGateway implements OnGatewayInit {
  private readonly logger = new Logger(DanmakuGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly danmaku: DanmakuService,
    private readonly accounts: AccountStatusService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.authenticate(socket as ViewerSocket)
        .then((user) => {
          (socket as ViewerSocket).data.user = user;
          this.accounts.remember(user.id, "ACTIVE");
          next();
        })
        .catch((error: unknown) => {
          this.logger.warn(error instanceof Error ? error.message : "UNAUTHENTICATED");
          next(new Error("UNAUTHENTICATED"));
        });
    });
  }

  @SubscribeMessage("danmaku:join")
  async join(client: ViewerSocket, payload: { episodeId?: unknown }): Promise<{ ok: boolean }> {
    const user = client.data.user;
    const episodeId = payload?.episodeId;
    if (!user || typeof episodeId !== "number" || !Number.isInteger(episodeId))
      return { ok: false };
    try {
      // Cùng hàm với API phát: phim nháp và tuổi đều không được vào phòng.
      const episode = await requireWatchableEpisode(this.prisma, episodeId, {
        birthYear: user.birthYear,
        year: new Clock(new Date()).year(),
      });
      for (const room of client.rooms) {
        if (room.startsWith("episode:")) await client.leave(room);
      }
      await client.join(`episode:${episode.id}`);
      client.data.episodeId = episode.id;
      client.data.durationSec = episode.durationSec;
      return { ok: true };
    } catch (error) {
      if (error instanceof AppError) return { ok: false };
      throw error;
    }
  }

  @SubscribeMessage("danmaku:send")
  async send(
    client: ViewerSocket,
    payload: { episodeId?: unknown; content?: unknown; timeMs?: unknown },
  ) {
    const user = client.data.user;
    if (!user) return { ok: false as const };
    try {
      const result = await this.danmaku.send({
        userId: user.id,
        episodeId: payload?.episodeId,
        joinedEpisodeId: client.data.episodeId ?? null,
        durationSec: client.data.durationSec ?? null,
        content: payload?.content,
        timeMs: payload?.timeMs,
      });
      if (result.kind === "saved") {
        this.server.to(`episode:${result.episodeId}`).emit("danmaku:new", result.message);
        return { ok: true as const, id: result.message.id };
      }
      if (result.kind === "rejected") {
        client.emit("danmaku:rejected", {
          reason: result.reason,
          ...(result.retryAfterMs != null ? { retryAfterMs: result.retryAfterMs } : {}),
        });
        return { ok: false as const, reason: result.reason };
      }
      if (result.kind === "locked") {
        setImmediate(() => client.disconnect(true));
        return { ok: false as const };
      }
      return { ok: false as const };
    } catch {
      return { ok: false as const };
    }
  }

  private async authenticate(socket: ViewerSocket): Promise<UserProfile> {
    const token = readCookie(socket.handshake.headers.cookie, SESSION_COOKIE);
    if (!token) throw new Error("UNAUTHENTICATED");
    const payload = this.jwt.verify<SessionPayload>(token);
    if (typeof payload.sub !== "number" || typeof payload.pv !== "string") {
      throw new Error("UNAUTHENTICATED");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== "ACTIVE" || passwordVersion(user.passwordHash) !== payload.pv) {
      throw new Error("UNAUTHENTICATED");
    }
    return toProfile(user);
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
