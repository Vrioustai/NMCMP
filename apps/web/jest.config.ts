import type { Config } from "jest";

// Chỉ test hàm thuần trong lib/, không test component.
const config: Config = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/lib/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      // tsconfig của web dùng module ESNext cho Next.js; Jest cần CommonJS.
      { tsconfig: { module: "commonjs", moduleResolution: "node10", jsx: "react-jsx" } },
    ],
  },
};

export default config;
