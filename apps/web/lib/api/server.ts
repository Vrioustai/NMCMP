import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { safeNext } from "../safe-next";
import { ApiError, readApiError } from "./errors";

type ServerOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  notFoundOn404?: boolean;
  redirectOn401?: string;
};

function apiOrigin(): string {
  const raw = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
  return raw.trim().replace(/\s+#.*$/, "") || "http://localhost:4000";
}

export async function apiServer<T>(path: string, options: ServerOptions = {}): Promise<T> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/api${path}`, {
      method: options.method ?? "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(options.body ? { "content-type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(503, "INTERNAL");
  }
  if (response.status === 401 && options.redirectOn401) {
    redirect(`/login?next=${encodeURIComponent(safeNext(options.redirectOn401))}`);
  }
  if (response.status === 404 && options.notFoundOn404 !== false) notFound();
  if (!response.ok) throw await readApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
