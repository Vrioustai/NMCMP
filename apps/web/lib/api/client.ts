import { safeNext } from "../safe-next";
import { ApiError, readApiError } from "./errors";

type ClientOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown | FormData;
};

export async function apiClient<T>(path: string, options: ClientOptions = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;
  const body: BodyInit | undefined = isForm
    ? (options.body as FormData)
    : options.body === undefined
      ? undefined
      : JSON.stringify(options.body);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: body === undefined || isForm ? undefined : { "content-type": "application/json" },
      body,
    });
  } catch {
    throw new ApiError(503, "INTERNAL");
  }
  if (!response.ok) {
    const error = await readApiError(response);
    const onLogin = typeof window !== "undefined" && window.location.pathname.startsWith("/login");
    if (error.code === "ACCOUNT_LOCKED" && typeof window !== "undefined") {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      if (!onLogin) window.location.assign("/?locked=1");
    } else if (error.status === 401 && !onLogin && typeof window !== "undefined") {
      const next = safeNext(
        window.location.pathname + window.location.search,
        window.location.origin,
      );
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    throw error;
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
