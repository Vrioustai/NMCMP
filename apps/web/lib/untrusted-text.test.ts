import { readFileSync } from "fs";
import path from "path";

const files = ["components/danmaku/danmaku-layer.tsx", "components/danmaku/report-dialog.tsx"];

describe("untrusted text", () => {
  it("writes Danmaku with textContent and does not assign HTML", () => {
    for (const file of files) {
      const source = readFileSync(path.join(__dirname, "..", file), "utf8");
      expect(source).toContain("textContent");
      expect(source).not.toContain("innerHTML");
      expect(source).not.toContain("dangerouslySetInnerHTML");
    }
  });
});
