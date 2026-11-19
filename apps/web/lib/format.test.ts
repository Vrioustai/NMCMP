import { formatDate, formatDuration, formatNumber, formatScore, formatTime } from "./format";

describe("format", () => {
  const instant = new Date("2025-12-31T17:30:00.000Z");

  it("formats the Ho Chi Minh calendar date and time", () => {
    expect(formatDate(instant)).toBe("01/01/2026");
    expect(formatTime(instant)).toBe("00:30");
  });

  it("formats Vietnamese numbers and scores", () => {
    expect(formatNumber(12480)).toBe("12.480");
    expect(formatScore(4.4)).toBe("4,4/5");
  });

  it("formats a duration as a clock", () => {
    expect(formatDuration(12 * 60 + 30)).toBe("12:30");
    expect(formatDuration(5)).toBe("0:05");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
