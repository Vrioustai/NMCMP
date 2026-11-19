import { ERROR_CODES, errorMessage } from "./error-messages";

describe("errorMessage", () => {
  it("has a non-empty sentence for every API code", () => {
    const seen = new Set<string>();
    for (const code of ERROR_CODES) {
      const message = errorMessage(code);
      expect(message.trim().length).toBeGreaterThan(0);
      expect(seen.has(message)).toBe(false);
      seen.add(message);
    }
    expect(ERROR_CODES).toHaveLength(17);
  });

  it("uses one fallback sentence for an unknown code", () => {
    expect(errorMessage(undefined)).toBe("Có lỗi xảy ra, vui lòng thử lại.");
    expect(errorMessage("INTERNAL")).toBe("Có lỗi xảy ra, vui lòng thử lại.");
  });
});
