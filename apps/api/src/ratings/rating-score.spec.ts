import { ratingAverage } from "./rating-score";

describe("ratingAverage", () => {
  it("rounds to one decimal and stays empty when nobody has scored", () => {
    expect(ratingAverage(0, 0)).toBeNull();
    expect(ratingAverage(5, 3)).toBe(1.7);
    expect(ratingAverage(9, 2)).toBe(4.5);
  });
});
