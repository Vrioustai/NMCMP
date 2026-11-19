import {
  containsBannedWord,
  danmakuLength,
  exceedsDanmakuLength,
  normalizeDanmaku,
} from "./danmaku-text";

describe("danmaku text", () => {
  it("normalizes to NFC, drops control characters and trims", () => {
    expect(normalizeDanmaku(`  e\u0301\u0000 xin  `)).toBe("é xin");
    expect(normalizeDanmaku(12)).toBe("");
    expect(danmakuLength("👍")).toBe(1);
    expect(exceedsDanmakuLength("a".repeat(100))).toBe(false);
    expect(exceedsDanmakuLength("a".repeat(101))).toBe(true);
  });

  it("matches a banned word without catching a longer word", () => {
    const words = ["ngu"];
    expect(containsBannedWord("nguyên", words)).toBe(false);
    expect(containsBannedWord("đồ ngu", words)).toBe(true);
    expect(containsBannedWord("NGU!", words)).toBe(true);
    expect(containsBannedWord("xin chào", words)).toBe(false);
  });
});
