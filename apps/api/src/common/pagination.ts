export const PAGE_SIZE_DEFAULT = 24;
export const PAGE_SIZE_MAX = 48;

export type PageQuery = { page: number; pageSize: number; skip: number; take: number };

export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };

export function pageQuery(input: { page?: unknown; pageSize?: unknown } = {}): PageQuery {
  const page = atLeastOne(input.page, 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, atLeastOne(input.pageSize, PAGE_SIZE_DEFAULT));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function atLeastOne(value: unknown, fallback: number): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value.trim())
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}
