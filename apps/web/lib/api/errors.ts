import { errorMessage } from "../error-messages";
import type { FieldError } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: FieldError[];

  constructor(status: number, code: string, details?: FieldError[]) {
    super(errorMessage(code));
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function readApiError(response: Response): Promise<ApiError> {
  let code = "INTERNAL";
  let details: FieldError[] | undefined;
  try {
    const body = (await response.json()) as {
      error?: { code?: unknown; details?: FieldError[] };
    };
    if (typeof body.error?.code === "string") code = body.error.code;
    if (Array.isArray(body.error?.details)) details = body.error.details;
  } catch {
    code = "INTERNAL";
  }
  return new ApiError(response.status, code, details);
}
