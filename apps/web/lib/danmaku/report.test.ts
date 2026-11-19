import { REPORT_MAX_LENGTH } from "@movie/contracts";
import { REPORT_OTHER, chosenReason } from "./report";

describe("report reason", () => {
  it("sends a preset or a custom note within 200 characters", () => {
    expect(chosenReason("Spam hoặc quảng cáo", "")).toBe("Spam hoặc quảng cáo");
    expect(chosenReason(REPORT_OTHER, "  quá nhanh  ")).toBe("quá nhanh");
    expect(chosenReason(REPORT_OTHER, " ")).toBeNull();
    expect(chosenReason(REPORT_OTHER, "a".repeat(REPORT_MAX_LENGTH + 1))).toBeNull();
    expect(chosenReason("tự bịa", "không dùng")).toBeNull();
  });
});
