import { Clock } from "./clock";

describe("Clock", () => {
  it("keeps the instant it was given", () => {
    const instant = new Date("2026-06-01T03:00:00.000Z");
    const clock = new Clock(instant);
    expect(clock.now()).toBe(instant);
  });

  it("uses the Ho Chi Minh calendar year across the UTC new-year boundary", () => {
    expect(new Clock(new Date("2025-12-31T16:30:00.000Z")).year()).toBe(2025);
    expect(new Clock(new Date("2025-12-31T17:30:00.000Z")).year()).toBe(2026);
  });
});
