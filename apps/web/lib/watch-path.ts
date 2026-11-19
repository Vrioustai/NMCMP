export function watchPath(slug: string, episodeId: number): string {
  return `/watch/${encodeURIComponent(slug)}/${episodeId}`;
}

export function loginNext(path: string): string {
  return `/login?next=${encodeURIComponent(path)}`;
}
