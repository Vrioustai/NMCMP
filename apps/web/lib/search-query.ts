import { SEARCH_QUERY_MAX_LENGTH } from "@movie/contracts";

const YEAR_MIN = 1888;
const YEAR_MAX = 2100;

export type SearchQuery = {
  q?: string;
  genre?: number;
  country?: number;
  releaseYear?: number;
  page?: number;
};

type RawValue = string | string[] | undefined;

function first(value: RawValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = raw?.trim();
  return text ? text : undefined;
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) return undefined;
  return number;
}

function year(value: string | undefined): number | undefined {
  const number = positiveInt(value);
  if (number === undefined || number < YEAR_MIN || number > YEAR_MAX) return undefined;
  return number;
}

export function parseSearchParams(raw: Record<string, RawValue>): SearchQuery {
  const q = first(raw.q)?.slice(0, SEARCH_QUERY_MAX_LENGTH);
  const genre = positiveInt(first(raw.genre));
  const country = positiveInt(first(raw.country));
  const releaseYear = year(first(raw.releaseYear));
  const page = positiveInt(first(raw.page));
  return {
    ...(q ? { q } : {}),
    ...(genre ? { genre } : {}),
    ...(country ? { country } : {}),
    ...(releaseYear ? { releaseYear } : {}),
    page: page ?? 1,
  };
}

export function searchPath(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.genre) params.set("genre", String(query.genre));
  if (query.country) params.set("country", String(query.country));
  if (query.releaseYear) params.set("releaseYear", String(query.releaseYear));
  if (query.page && query.page > 1) params.set("page", String(query.page));
  const text = params.toString();
  return text ? `/search?${text}` : "/search";
}

export function moviesQuery(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.genre) params.set("genre", String(query.genre));
  if (query.country) params.set("country", String(query.country));
  if (query.releaseYear) params.set("releaseYear", String(query.releaseYear));
  params.set("page", String(query.page && query.page > 0 ? query.page : 1));
  params.set("pageSize", "24");
  return params.toString();
}
