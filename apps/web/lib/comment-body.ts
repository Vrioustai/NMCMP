import { COMMENT_MAX_LENGTH } from "@movie/contracts";

export function commentBody(value: string): string | null {
  const text = value
    .normalize("NFC")
    .replace(/\p{Cc}/gu, "")
    .trim();
  const length = Array.from(text).length;
  if (length < 1 || length > COMMENT_MAX_LENGTH) return null;
  return text;
}
