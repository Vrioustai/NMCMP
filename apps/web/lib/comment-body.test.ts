import { COMMENT_MAX_LENGTH } from "@movie/contracts";
import { commentBody } from "./comment-body";

describe("commentBody", () => {
  it("keeps a trimmed note and rejects an empty or oversized one", () => {
    expect(commentBody("  hay quá  ")).toBe("hay quá");
    expect(commentBody(" \u0001 ")).toBeNull();
    expect(commentBody("a".repeat(COMMENT_MAX_LENGTH + 1))).toBeNull();
  });
});
