const { execSync } = require("node:child_process");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");

function readEnvFile(filePath) {
  const values = {};
  if (!existsSync(filePath)) return values;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    values[key] = value;
  }
  return values;
}

module.exports = async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  const env = { ...readEnvFile(path.join(root, ".env")), ...process.env };
  if (!env.DATABASE_URL_TEST) {
    throw new Error("Thiếu DATABASE_URL_TEST. Đặt biến này trong apps/api/.env.");
  }
  env.DATABASE_URL = env.DATABASE_URL_TEST;
  execSync("pnpm exec prisma migrate deploy", {
    cwd: root,
    env,
    stdio: "inherit",
  });
};
