import type { FieldError } from "./api/types";

export function errorsByField(details: FieldError[] | undefined): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const detail of details ?? []) {
    if (!fields[detail.field]) fields[detail.field] = detail.message;
  }
  return fields;
}
