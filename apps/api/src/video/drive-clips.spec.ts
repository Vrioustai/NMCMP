import {
  acceptDriveTicket,
  driveClipCount,
  driveFileIdForSlug,
  drivePlaybackUrl,
  hlsFileIdForSlug,
} from "./drive-clips";

const SECRET = "test-secret-test-secret-test-secret";
const NOW = new Date("2026-06-15T03:00:00.000Z");
const FILE = "1Hg_uZQypaLZL_nHi9jR_w5xe4c2wrsR8";

describe("drive clips", () => {
  it("maps a file for each movie that exists on Drive", () => {
    expect(driveClipCount()).toBe(73);
    expect(driveFileIdForSlug("mat-ma-goc")).toBe(FILE);
    expect(driveFileIdForSlug("su-thi-odyssey")).toBe("1dzOYkPkJ4aAt2v-J1soh-ECvtdGuDm05");
    expect(hlsFileIdForSlug("su-thi-odyssey")).toBe("1dzOYkPkJ4aAt2v-J1soh-ECvtdGuDm05");
    expect(hlsFileIdForSlug("mat-ma-goc")).toBeNull();
    expect(driveFileIdForSlug("ho-den-tu-than")).toBe("1487Cks19bcubvVQO883g5jBuGH5QePTz");
    expect(driveFileIdForSlug("toi-pham-nhan-ban-2049")).toBe("1fi-iz-ckG977dGzFCF2Joo8dnSGqJ7Wo");
    expect(driveFileIdForSlug("nguoi-ve-tu-sao-hoa")).toBe("1de1kdYqf3Lr9wL2gn3dXdZOjN8_p6SkN");
    expect(driveFileIdForSlug("ban-trai-song-sinh")).toBe("1orOwLeFThH47NHqlDgyoQxPYPfSZCfCK");
    expect(driveFileIdForSlug("la-anh")).toBe("1_1BT5a9BT-XtneZGvBoDSJs9OO4EUt3Z");
    expect(driveFileIdForSlug("gau-hai-huoc-bat-nham-vua-tieu-chay-tap-161")).toBe(
      "1GzNIJT5syI2Z7pVb0F1wkOYES-lvNR_B",
    );
    expect(driveFileIdForSlug("nha-gia-tien-gia-minh-trung-tri-nhung-ke-da-giet-minh")).toBeNull();
    expect(driveFileIdForSlug("phim-khac")).toBeNull();
    expect(driveFileIdForSlug(null)).toBeNull();
  });

  it("accepts a ticket it just signed and rejects a changed file or an old expiry", () => {
    const exp = Math.floor(NOW.getTime() / 1000) + 60;
    const url = new URL(drivePlaybackUrl(FILE, exp, SECRET, "http://localhost:3000/"));
    const sig = url.searchParams.get("sig") ?? "";
    expect(url.pathname).toBe(`/api/video/drive/${FILE}`);
    expect(acceptDriveTicket(FILE, String(exp), sig, SECRET, NOW)).toBe(true);
    expect(acceptDriveTicket("1otherFileIdxxxxxx", String(exp), sig, SECRET, NOW)).toBe(false);
    expect(acceptDriveTicket(FILE, String(exp - 120), sig, SECRET, NOW)).toBe(false);
    expect(acceptDriveTicket(FILE, String(exp), "khac", SECRET, NOW)).toBe(false);
  });
});
