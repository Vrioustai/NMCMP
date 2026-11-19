import { REPORT_MAX_LENGTH } from "@movie/contracts";

export const REPORT_PRESETS = [
  "Nội dung không phù hợp",
  "Spam hoặc quảng cáo",
  "Bạo lực hoặc khiêu khích",
] as const;

export const REPORT_OTHER = "other";

export function chosenReason(choice: string, custom: string): string | null {
  const preset = REPORT_PRESETS.find((item) => item === choice);
  const text = (preset ?? (choice === REPORT_OTHER ? custom : "")).normalize("NFC").trim();
  const length = Array.from(text).length;
  if (length < 1 || length > REPORT_MAX_LENGTH) return null;
  return text;
}
