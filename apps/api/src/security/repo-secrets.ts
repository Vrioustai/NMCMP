import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".next",
  "coverage",
  "uploads",
  ".git",
  "NMCNPM",
]);

const RULES = [
  { name: "private-key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "private-jwk", pattern: /"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/ },
  { name: "github-token", pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "stripe-live", pattern: /sk_live_[A-Za-z0-9]{10,}/ },
] as const;

export type SecretHit = { file: string; rule: string };

export function findSecrets(root: string): SecretHit[] {
  const hits: SecretHit[] = [];
  walk(root, root, hits);
  return hits;
}

function walk(root: string, current: string, hits: SecretHit[]): void {
  for (const name of readdirSync(current)) {
    if (SKIP_DIRS.has(name) || name === ".env" || name.startsWith(".env.")) continue;
    const full = path.join(current, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      walk(root, full, hits);
      continue;
    }
    if (!info.isFile() || info.size > 1_000_000 || !isText(name)) continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("\0")) continue;
    for (const rule of RULES) {
      if (rule.pattern.test(text)) hits.push({ file: path.relative(root, full), rule: rule.name });
    }
  }
}

function isText(name: string): boolean {
  const extension = path.extname(name).toLowerCase();
  return ![
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".ico",
    ".woff",
    ".woff2",
    ".pdf",
    ".mp4",
  ].includes(extension);
}
