import { safeNext } from "./safe-next";

const origin = "http://localhost:3000";

describe("safeNext", () => {
  it("keeps an internal path", () => {
    expect(safeNext("/me", origin)).toBe("/me");
    expect(safeNext("/search?q=train", origin)).toBe("/search?q=train");
  });

  it("A11 accepts an internal movie path and rejects open redirects", () => {
    expect(safeNext("/movies/abc?x=1", origin)).toBe("/movies/abc?x=1");
    expect(safeNext("//x", origin)).toBe("/");
    expect(safeNext("/\\x", origin)).toBe("/");
    expect(safeNext("http://x", origin)).toBe("/");
    expect(safeNext("javascript:alert(1)", origin)).toBe("/");
  });

  it("rejects other sites, backslashes, and control characters", () => {
    expect(safeNext("//evil.example", origin)).toBe("/");
    expect(safeNext("http://evil.example/phim", origin)).toBe("/");
    expect(safeNext("javascript:alert(1)", origin)).toBe("/");
    expect(safeNext("/\\x", origin)).toBe("/");
    expect(safeNext("/\ttrang", origin)).toBe("/");
    expect(safeNext(null, origin)).toBe("/");
  });
});
