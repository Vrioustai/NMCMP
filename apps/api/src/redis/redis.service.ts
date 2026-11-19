import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

type RedisCommands = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, expiryMode: "EX", ttlSeconds: number): Promise<unknown>;
  set(key: string, value: string, expiryMode: "PX", ttlMs: number, nx: "NX"): Promise<"OK" | null>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<unknown>;
  ping(): Promise<string>;
  connect(): Promise<void>;
  quit(): Promise<unknown>;
};

@Injectable()
export class RedisService implements OnModuleDestroy {
  isAvailable = false;
  private warned = false;
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly client: RedisCommands) {}

  static connect(url: string): RedisService {
    const client = new Redis(url, {
      lazyConnect: true,
      // Hàng đợi tắt: Redis nằm xuống thì lệnh lỗi ngay, request không chờ kết nối lại.
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      commandTimeout: 1000,
    });
    const service = new RedisService(client);
    client.on("error", service.noteOutage.bind(service));
    client.on("ready", service.noteReady.bind(service));
    void service.begin();
    return service;
  }

  private async begin(): Promise<void> {
    try {
      await this.client.connect();
    } catch {
      this.noteOutage();
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable) return null;
    try {
      return await this.client.get(key);
    } catch {
      this.noteOutage();
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      await this.client.set(key, value, "EX", ttlSeconds);
      return true;
    } catch {
      this.noteOutage();
      return false;
    }
  }

  async setNxPx(key: string, value: string, ttlMs: number): Promise<"ok" | "busy" | "down"> {
    if (!this.isAvailable) return "down";
    try {
      const reply = await this.client.set(key, value, "PX", ttlMs, "NX");
      return reply === "OK" ? "ok" : "busy";
    } catch {
      this.noteOutage();
      return "down";
    }
  }

  async pttl(key: string): Promise<number | null> {
    if (!this.isAvailable) return null;
    try {
      return await this.client.pttl(key);
    } catch {
      this.noteOutage();
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable) return;
    try {
      await this.client.del(key);
    } catch {
      this.noteOutage();
    }
  }

  async ping(): Promise<boolean> {
    try {
      const reply = await this.client.ping();
      if (reply !== "PONG") {
        this.noteOutage();
        return false;
      }
      this.noteReady();
      return true;
    } catch {
      this.noteOutage();
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // Đang tắt tiến trình: lỗi đóng kết nối không cần nổi lên.
    }
  }

  private noteReady(): void {
    this.isAvailable = true;
    this.warned = false;
  }

  private noteOutage(): void {
    const shouldWarn = this.isAvailable || !this.warned;
    this.isAvailable = false;
    if (!shouldWarn) return;
    this.warned = true;
    this.logger.warn("Redis không dùng được, chuyển sang đường lui.");
  }
}
