import type { Config } from "jest";

const config: Config = {
  rootDir: "src",
  testEnvironment: "node",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: { "^.+\\.ts$": "ts-jest" },
  collectCoverageFrom: ["**/*.service.ts"],
  coverageDirectory: "../coverage",
  // Ngưỡng tính trên các service (nơi chứa nghiệp vụ), thiếu thì lệnh test trả mã lỗi.
  coverageThreshold: {
    global: { statements: 60, branches: 60, functions: 60, lines: 60 },
  },
};

export default config;
