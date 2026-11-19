import { inclusiveDays, rangeEnding, vietnamDay } from "./stats-range";

describe("stats range", () => {
  it("uses the Vietnam calendar and keeps a preset inside 90 days", () => {
    expect(vietnamDay(new Date("2026-11-19T17:00:00.000Z"))).toBe("2026-11-20");
    expect(rangeEnding("2026-11-19", 7)).toEqual({ from: "2026-11-13", to: "2026-11-19" });
    expect(inclusiveDays("2026-11-13", "2026-11-19")).toBe(7);
    expect(inclusiveDays(rangeEnding("2026-11-19", 90).from, "2026-11-19")).toBe(90);
  });
});
