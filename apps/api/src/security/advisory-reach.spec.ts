import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../../..");
const SOURCE = ["apps/api/src", "apps/web"];

describe("high advisory reach", () => {
  it("does not import deepmerge-ts or postcss from application source", () => {
    const hits = SOURCE.flatMap((dir) => importsOf(path.join(ROOT, dir), path.join(ROOT, dir)));
    expect(hits).toEqual([]);
  });
});

function importsOf(root: string, current: string): string[] {
  const hits: string[] = [];
  for (const name of readdirSync(current)) {
    if (name === "node_modules" || name === ".next" || name === "dist") continue;
    const full = path.join(current, name);
    const info = statSync(full);
    if (info.isDirectory()) {
      hits.push(...importsOf(root, full));
      continue;
    }
    if (!/\.(ts|tsx|js|mjs)$/.test(name)) continue;
    const text = readFileSync(full, "utf8");
    if (/\bfrom\s+["']postcss["']|\brequire\(\s*["']postcss["']/.test(text)) {
      hits.push(`${path.relative(root, full)}:postcss`);
    }
    if (/\bfrom\s+["']deepmerge-ts["']|\brequire\(\s*["']deepmerge-ts["']/.test(text)) {
      hits.push(`${path.relative(root, full)}:deepmerge-ts`);
    }
  }
  return hits;
}
