import { pageQuery } from "./pagination";

describe("pageQuery", () => {
  it("starts at page 1 with 24 items", () => {
    expect(pageQuery()).toEqual({ page: 1, pageSize: 24, skip: 0, take: 24 });
  });

  it("caps the page size at 48 and reads numeric strings", () => {
    expect(pageQuery({ page: "3", pageSize: "12" })).toEqual({
      page: 3,
      pageSize: 12,
      skip: 24,
      take: 12,
    });
    expect(pageQuery({ page: 2, pageSize: 100 }).pageSize).toBe(48);
    expect(pageQuery({ page: 2, pageSize: 100 }).skip).toBe(48);
  });

  it("falls back when the page or size is not a positive integer", () => {
    expect(pageQuery({ page: 0, pageSize: -1 })).toEqual({
      page: 1,
      pageSize: 24,
      skip: 0,
      take: 24,
    });
    expect(pageQuery({ page: "1.5", pageSize: "nope" }).page).toBe(1);
  });
});
