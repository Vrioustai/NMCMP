import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { findSecrets } from "./repo-secrets";

describe("findSecrets", () => {
  it("TEST_UC07_08 finds a private key and ignores env files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "fgz-secrets-"));
    try {
      writeFileSync(path.join(root, "key.ts"), `${"-----BEGIN "}${"PRIVATE KEY-----"}\nabc\n`);
      writeFileSync(path.join(root, ".env"), `${"-----BEGIN "}${"PRIVATE KEY-----"}\nhidden\n`);
      mkdirSync(path.join(root, "node_modules"));
      writeFileSync(
        path.join(root, "node_modules", "lib.js"),
        `${"-----BEGIN "}${"PRIVATE KEY-----"}\nskip\n`,
      );
      const hits = findSecrets(root);
      expect(hits).toEqual([{ file: "key.ts", rule: "private-key" }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("TEST_UC07_08 finds no signing key in the repository", () => {
    const root = path.resolve(__dirname, "../../../..");
    expect(findSecrets(root)).toEqual([]);
  });
});
