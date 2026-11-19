import { loadEnvFile } from "node:process";
import { io, type Socket } from "socket.io-client";

try {
  loadEnvFile();
} catch (error) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (code !== "ENOENT") throw error;
}

const CONNECTIONS = readInt("CONNECTIONS", 200);
const SAMPLES = readInt("SAMPLES", 20);
const COOLDOWN_MS = 3_100;
const RECEIVE_TIMEOUT_MS = 2_000;
const THRESHOLD_MS = 500;

type SendAck = { ok?: boolean; reason?: string };
type Incoming = { content?: unknown };

async function main(): Promise<number> {
  const apiUrl = (process.env.API_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
  const origin = webOrigin();
  const episodeId = readInt("EPISODE_ID", 0);
  const token = process.env.COOKIE?.trim() ?? "";
  if (episodeId < 1 || token.length === 0 || CONNECTIONS < 2 || SAMPLES < 1) {
    process.stderr.write(
      "Cần EPISODE_ID của một tập đã công khai và COOKIE là giá trị fgz_session.\n",
    );
    return 1;
  }

  const sockets = await connectAll(apiUrl, origin, token);
  try {
    const joined = await mapLimit(sockets, 25, (socket) => join(socket, episodeId));
    const ready = joined.filter(Boolean).length;
    if (ready !== sockets.length) {
      process.stderr.write(`Vào phòng được ${ready}/${sockets.length}.\n`);
      return 1;
    }
    const listeners = sockets.slice(1);
    const latencies: number[] = [];
    let missed = 0;
    for (let index = 0; index < SAMPLES; index += 1) {
      const sample = await sendOnce(sockets[0], listeners, episodeId, index);
      if (sample.kind === "rejected") {
        process.stderr.write(`Lượt gửi bị từ chối: ${sample.reason}.\n`);
        return 1;
      }
      latencies.push(...sample.latencies);
      missed += listeners.length - sample.latencies.length;
      if (index + 1 < SAMPLES) await delay(COOLDOWN_MS);
    }
    return report(sockets.length, latencies, missed, listeners.length);
  } finally {
    for (const socket of sockets) socket.close();
  }
}

async function connectAll(apiUrl: string, origin: string, token: string): Promise<Socket[]> {
  const opened = await mapLimit(
    Array.from({ length: CONNECTIONS }, (_, index) => index),
    25,
    () => openSocket(apiUrl, origin, token),
  );
  return opened;
}

function openSocket(apiUrl: string, origin: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // forceNew: nếu không có, mọi socket dùng chung một kết nối.
    const socket = io(`${apiUrl}/danmaku`, {
      forceNew: true,
      transports: ["websocket"],
      reconnection: false,
      timeout: 10_000,
      extraHeaders: { origin, cookie: `fgz_session=${token}` },
    });
    const fail = (error: Error) => {
      socket.close();
      const message = error.message.includes(token) ? "Không kết nối được." : error.message;
      reject(new Error(message));
    };
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", fail);
  });
}

function join(socket: Socket, episodeId: number): Promise<boolean> {
  return new Promise((resolve) => {
    socket.timeout(10_000).emit("danmaku:join", { episodeId }, (error: unknown, body: SendAck) => {
      resolve(error == null && body?.ok === true);
    });
  });
}

async function sendOnce(
  sender: Socket,
  listeners: Socket[],
  episodeId: number,
  index: number,
): Promise<{ kind: "ok"; latencies: number[] } | { kind: "rejected"; reason: string }> {
  const content = `m${index}`;
  const sentAt = performance.now();
  const latencies: number[] = [];
  const onMessage = (message: Incoming) => {
    if (message.content !== content) return;
    latencies.push(performance.now() - sentAt);
  };
  for (const socket of listeners) socket.on("danmaku:new", onMessage);
  const outcome = await new Promise<{ kind: "ok" } | { kind: "rejected"; reason: string }>(
    (resolve) => {
      sender
        .timeout(10_000)
        .emit(
          "danmaku:send",
          { episodeId, content, timeMs: 0 },
          (error: unknown, body: SendAck) => {
            if (error != null || body?.ok !== true) {
              resolve({ kind: "rejected", reason: body?.reason ?? "timeout" });
              return;
            }
            resolve({ kind: "ok" });
          },
        );
    },
  );
  if (outcome.kind === "ok")
    await waitUntil(() => latencies.length >= listeners.length, RECEIVE_TIMEOUT_MS);
  for (const socket of listeners) socket.off("danmaku:new", onMessage);
  if (outcome.kind === "rejected") return outcome;
  return { kind: "ok", latencies: latencies.slice() };
}

function report(
  connections: number,
  latencies: number[],
  missed: number,
  listeners: number,
): number {
  const sorted = latencies.slice().sort((left, right) => left - right);
  const p95 = sorted.length === 0 ? Number.POSITIVE_INFINITY : percentile(sorted, 95);
  const passed = missed === 0 && sorted.length === SAMPLES * listeners && p95 <= THRESHOLD_MS;
  process.stdout.write(
    [
      `connections: ${connections}`,
      `sends: ${SAMPLES}`,
      `listeners: ${listeners}`,
      `received: ${sorted.length}`,
      `missed: ${missed}`,
      `p95_ms: ${formatMs(p95)}`,
      `max_ms: ${formatMs(sorted.at(-1) ?? Number.POSITIVE_INFINITY)}`,
      `threshold_ms: ${THRESHOLD_MS}`,
      `result: ${passed ? "pass" : "fail"}`,
      "",
    ].join("\n"),
  );
  return passed ? 0 : 1;
}

function percentile(sorted: number[], percent: number): number {
  const index = Math.ceil((percent / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))];
}

function formatMs(value: number): string {
  if (!Number.isFinite(value)) return "khong-do-duoc";
  return value.toFixed(1);
}

function webOrigin(): string {
  // Gateway so đúng origin đã chuẩn hóa, nên dấu / cuối trong biến môi trường phải bị bỏ.
  return new URL(process.env.WEB_ORIGIN ?? "http://localhost:3000").origin;
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : fallback;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(done: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!done() && Date.now() - start < timeoutMs) await delay(20);
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

void main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Đo độ trễ thất bại.";
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
