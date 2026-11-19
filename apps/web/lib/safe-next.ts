function hasForbiddenCharacter(value: string): boolean {
  if (value.includes("\\")) return true;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

// Chỉ nhận đường dẫn nội bộ. Dấu \ bị trình duyệt hiểu thành // nên phải loại trước.
export function safeNext(
  next: string | null | undefined,
  origin = "http://localhost:3000",
): string {
  if (!next || hasForbiddenCharacter(next)) return "/";
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}
