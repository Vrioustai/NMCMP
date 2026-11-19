import { progressPercent } from "./history-progress";

describe("progressPercent", () => {
  it("fills the bar from the watched seconds", () => {
    expect(progressPercent(30, 120)).toBe(25);
    expect(progressPercent(200, 100)).toBe(100);
    expect(progressPercent(10, null)).toBeNull();
    expect(progressPercent(0, 100)).toBe(0);
  });
});
