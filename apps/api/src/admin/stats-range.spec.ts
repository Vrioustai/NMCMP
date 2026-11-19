import { addDays, inclusiveDays, statsRange, vietnamDay } from "./stats-range";

describe("statsRange", () => {
  const now = new Date("2026-11-19T16:30:00.000Z");

  it("cuts the calendar on Vietnam time", () => {
    expect(vietnamDay(new Date("2026-11-19T16:59:00.000Z"))).toBe("2026-11-19");
    expect(vietnamDay(new Date("2026-11-19T17:00:00.000Z"))).toBe("2026-11-20");
  });

  it("defaults to seven days and rejects a 91-day span", () => {
    expect(statsRange({}, now)).toEqual({ from: "2026-11-13", to: "2026-11-19" });
    expect(inclusiveDays("2026-11-13", "2026-11-19")).toBe(7);
    expect(inclusiveDays(addDays("2026-11-19", -90), "2026-11-19")).toBe(91);
    expect(() => statsRange({ from: addDays("2026-11-19", -90), to: "2026-11-19" }, now)).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED" }),
    );
    expect(() => statsRange({ from: "2026-11-20", to: "2026-11-19" }, now)).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED" }),
    );
  });
});
