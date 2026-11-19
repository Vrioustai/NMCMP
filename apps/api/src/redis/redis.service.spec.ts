import { Logger } from "@nestjs/common";
import { RedisService } from "./redis.service";

function fakeClient() {
  return {
    get: jest.fn<Promise<string | null>, [string]>(),
    set: jest.fn(),
    pttl: jest.fn<Promise<number>, [string]>().mockResolvedValue(-2),
    del: jest.fn<Promise<unknown>, [string]>(),
    ping: jest.fn<Promise<string>, []>(),
    connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    quit: jest.fn<Promise<unknown>, []>().mockResolvedValue("OK"),
  };
}

describe("RedisService", () => {
  let warn: jest.Spied<Logger["warn"]>;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  it("reads and writes while Redis answers", async () => {
    const client = fakeClient();
    client.ping.mockResolvedValue("PONG");
    client.get.mockResolvedValue("1");
    client.set.mockResolvedValue("OK");
    const service = new RedisService(client);
    await expect(service.ping()).resolves.toBe(true);
    expect(service.isAvailable).toBe(true);
    await expect(service.get("k")).resolves.toBe("1");
    await expect(service.set("k", "v", 30)).resolves.toBe(true);
    expect(client.set).toHaveBeenCalledWith("k", "v", "EX", 30);
  });

  it("falls back when a command fails and does not warn on every later read", async () => {
    const client = fakeClient();
    client.get.mockRejectedValue(new Error("down"));
    const service = new RedisService(client);
    service.isAvailable = true;
    await expect(service.get("k")).resolves.toBeNull();
    expect(service.isAvailable).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    await expect(service.get("k")).resolves.toBeNull();
    expect(client.get).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("warns once while ping keeps failing", async () => {
    const client = fakeClient();
    client.ping.mockRejectedValue(new Error("down"));
    const service = new RedisService(client);
    service.isAvailable = true;
    await expect(service.ping()).resolves.toBe(false);
    await expect(service.ping()).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(service.isAvailable).toBe(false);
  });

  it("returns false from set when Redis is already down", async () => {
    const client = fakeClient();
    const service = new RedisService(client);
    await expect(service.set("k", "v", 10)).resolves.toBe(false);
    expect(client.set).not.toHaveBeenCalled();
  });

  it("claims a rate-limit key once, then reports the key is busy", async () => {
    const client = fakeClient();
    client.set.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
    client.pttl.mockResolvedValue(2500);
    const service = new RedisService(client);
    service.isAvailable = true;
    await expect(service.setNxPx("danmaku:rl:1", "1", 3000)).resolves.toBe("ok");
    expect(client.set).toHaveBeenCalledWith("danmaku:rl:1", "1", "PX", 3000, "NX");
    await expect(service.setNxPx("danmaku:rl:1", "1", 3000)).resolves.toBe("busy");
    await expect(service.pttl("danmaku:rl:1")).resolves.toBe(2500);
  });

  it("does not claim a key when Redis is down", async () => {
    const client = fakeClient();
    const service = new RedisService(client);
    await expect(service.setNxPx("danmaku:rl:1", "1", 3000)).resolves.toBe("down");
    await expect(service.pttl("danmaku:rl:1")).resolves.toBeNull();
    expect(client.set).not.toHaveBeenCalled();
  });

  it("returns false from set when the write fails", async () => {
    const client = fakeClient();
    client.set.mockRejectedValue(new Error("down"));
    const service = new RedisService(client);
    service.isAvailable = true;
    await expect(service.set("k", "v", 10)).resolves.toBe(false);
    expect(service.isAvailable).toBe(false);
  });

  it("treats a reply other than PONG as down", async () => {
    const client = fakeClient();
    client.ping.mockResolvedValue("NO");
    const service = new RedisService(client);
    service.isAvailable = true;
    await expect(service.ping()).resolves.toBe(false);
  });

  it("closes the client on shutdown even if quit fails", async () => {
    const client = fakeClient();
    client.quit.mockRejectedValue(new Error("bye"));
    const service = new RedisService(client);
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });

  it("connects to the local Redis and closes the client", async () => {
    const service = RedisService.connect("redis://127.0.0.1:6379");
    try {
      for (let attempt = 0; attempt < 20 && !service.isAvailable; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(service.isAvailable).toBe(true);
    } finally {
      await service.onModuleDestroy();
    }
  });
});
