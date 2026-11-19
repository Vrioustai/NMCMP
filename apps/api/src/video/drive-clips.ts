import { createHmac, timingSafeEqual } from "node:crypto";

// Mỗi phim một file trên Drive. Không tải file về máy.
// Nhà Gia Tiên không có file trên Drive nên vẫn phát mẫu.
const DRIVE_CLIPS: Record<string, string> = {
  "alita-thien-than-chien-binh": "1BcBOj9p5vYqILz4yoQEh_7b6djPb1DaS",
  "anh-ao-den-sa-co-cau-cuu-anh-ho-vay-no-nha-minh-va-cai-ket-thua-ca-nguoi-dung":
    "1silDfoy4s265Kx_vOck5bbLA1bKhs9gK",
  "ba-ngoai-ma-lai-phim-ma-ngan-kinh-di": "1ASAX9nuCs_iTUVIbfzdNodIv4MsIs3_X",
  "ban-trai-song-sinh": "1orOwLeFThH47NHqlDgyoQxPYPfSZCfCK",
  "bat-cu-ai-den-khu-rung-nay-deu-khong-the-song-sot-tro-ve": "1DeiCL76tDrUjszEUoJ9_DwI2esaPqMhz",
  "beast-of-war": "1Q9A3YTx_HBL8Vs0UFNXYCUEgvn8XcgUZ",
  "bi-an-ve-thap-rua-ho-guom-ma-it-ai-biet": "1ibpuMBecyjDtSbiRWdEZ6OfbCUQ68Gu7",
  "bullet-train-sat-thu-doi-dau": "1ewcjcSHQ2ubJB9xWgvmtYyNYE-QW0B7w",
  "ca-map-sieu-bao-chua": "1gyTGgqQsczqLBNX2HVpglK0_wnpNvtYk",
  "chiec-guong-phim-ngan-kinh-di": "16Ef1oUbCO8Pqr0R1x0uG0dhhX-i7r15m",
  "chu-tich-giai-cuu-nu-giam-doc-ao-do": "1K04aHtTU9YTSag2t9z1Y3OYqvbSwvIhf",
  "chua-te-godzilla-de-vuon-bat-tu": "1mUgL2EbqPx0VYYbOzkEbKfU3iS0JIZRr",
  "co-gai-den-tu-ben-kia": "160diUZBH8tIZki3l7ccL0NmskivYYtZE",
  "con-dau-an-nhu-heo": "1UGytSL890jX2hzDNl2w4iIFO-WAXbEwW",
  "con-trai-vo-dung-me-khinh-thuong-vi-lam-noi-tro": "1THzDQ9_SEc0uquY2TUWgpNqc42yn_MOC",
  "cuoc-chien-tuong-lai": "1C0ON0LQN-gFY0vpDdRdVvwmo0iZEMcaU",
  "dac-vu-vo-hinh": "1zV8uM0XX-ZcccD7IT2cqeFBtKXnTxsvA",
  "dai-ca-va-chi-dai": "1r5hOKcdnn_XDXp305L7_ZaI5JfeFg8t6",
  "dai-mong-quy-ly": "18fyc5A8r4BGXTt3WGj5Njn-vuFRpcJO8",
  "dai-phung-da-canh-nhan": "1WOecXHsfPdg01Z0GBQAp6Ge0UtamTccu",
  "dau-truong-ao": "1GfjYswFlAH0xnrM2wfUi0MzuvFYN5-nJ",
  "doan-phim-kinh-di-dai-2-phut-gay-sot-tren-mang": "1uqoUSouMsPelKZe9321Rol_ghaw3OrN7",
  "du-phuong-hanh": "1WiEjEQhWMKEhDVaC-sN44tRu8eT-IESs",
  "dung-co-gion-phim-kinh-di-halloween": "1qtZ1CMAGFJlzo_ldVw_zCxI-_V4e9QpK",
  "full-speed-2016": "1gXr7RSGnIY8QNLZuW3BWjdadp5Kk-iBr",
  "gau-dan-phieu-luu-ky-cham-tran-bang-cuop-ac-quy-phi-phai-phan-4": "1o6dnZg7C-V1TvvXSnnsY6hlHiUMSyPBd",
  "gau-dan-phieu-luu-ky-nam-dai-canh-gioi-va-bup-be-tu-luyen-phan-3": "1HT86M7sAMJRT1t3OkyaziwprjZSI4eQE",
  "gau-hai-huoc-bat-nham-vua-tieu-chay-tap-161": "1GzNIJT5syI2Z7pVb0F1wkOYES-lvNR_B",
  "gau-hai-huoc-boc-cot-an-va-tap-141": "1vGjALNzNUv3Sva9NkVyAyjMw1YVqdDkc",
  "gau-hai-huoc-ca-lang-tieu-chay-tap-152": "18nRLHc_dYsk_R8-exWCcV6S5EgbXX8Hj",
  "gau-hai-huoc-heo-de-trung-cat-tap-147": "1q09Ry-PMGJj5JWPoXDmgwi2xFqVgmT34",
  "gau-hai-huoc-ke-hoach-vai-gay-tap-150": "1QRCFYGnpCYsbDPeMUXPqcoblRjU_XNEp",
  "gau-hai-huoc-kem-mat-phan-trau-tap-158": "1eZ5aZxzUbxLHqXHXCopqrRB9-bN9TC6r",
  "gau-hai-huoc-nhat-ky-thieu-gia-tap-137": "10K4RF558g_j1cReJXbFeVJWwC8To2SZj",
  "gau-hai-huoc-tiec-mung-phat-no-tap-155": "1UtDq5q_H8P5QqI4btIssIfVnKhSrhZ2R",
  "gia-dinh-tau-hai-tren-chiec-xe-bat-on": "1SvRrVJt_c0YN1VJQ-JmZ_g3XrwRrCq2V",
  "giai-cuu-guy": "1o4yLIJ3MgxHYOeRJjhubJu6av-N2Pq4L",
  "hanh-trinh-cua-moana": "1i712MAhFK31F388lI37FZa5IdrRuOqXs",
  "ho-den-tu-than": "1487Cks19bcubvVQO883g5jBuGH5QePTz",
  "ke-chu-muu-masterminds": "1CU2bIeGpY5235SW8j19QotS3nyCgnKdG",
  "ke-kien-tao": "1e-V4qaaTYctBwyuNw3QhQfkKME78t-VW",
  "la-anh": "1_1BT5a9BT-XtneZGvBoDSJs9OO4EUt3Z",
  "lac-du-nguyen": "14mxx2MIv6gWWi_Cl1msxH1XZ0IcjQCQl",
  "mac-vu-van-gian": "1Mlhnre8Hw5y5DhpNMzjTzDE8C1lS0_SB",
  "mat-ma-goc": "1Hg_uZQypaLZL_nHi9jR_w5xe4c2wrsR8",
  "me-toi-la-giang-ho": "1qDYPpwcom0oIevgXx4fkc3Af632CLhvx",
  "mot-ngay-cua-be": "1WPly2pm0S4BMWblcIl6dM8cv3XFcBKrI",
  "mua-he-nam-ay": "1JCsPQIjsgq0ZyZva_SCbofKZWZ5pL8aT",
  "nam-do-chung-ta-18": "1K1jKGSQcA6EiSaihNIiuuTfD9tUdHCzf",
  "ngoi-truong-dac-biet": "1tgywTROOd7-1DOF8k8tWTB99VIE-1DAO",
  "nguoi-ve-tu-sao-hoa": "1de1kdYqf3Lr9wL2gn3dXdZOjN8_p6SkN",
  "nha-xay-ra-hien-tuong-kinh-di-khi-nho-di-den-o": "1lGYotDLv1I08jKTUGp2u5GiT1xOrWxuV",
  "ninh-an-nhu-mong": "1P-nuBtu4mh95j6NTwGTLtb-Sv7bWUImd",
  "phi-phong-bi-mat-cai-chet-cua-truong-ban": "11LIwKbUYdGGDb4-KxFqLNuvmT3rU9OdU",
  "phia-ben-kia-thanh-pho": "1l2h5CQXwKAz_R3XroJBKZi4kzWCiUe4s",
  "sinh-vat-huyen-bi-nhung-bi-mat-cua-dumbledore": "1YTqJ7XRbQlksyRb2lzjACgdMZYkmw18u",
  "su-thi-odyssey": "1dzOYkPkJ4aAt2v-J1soh-ECvtdGuDm05",
  "tam-trai-dat": "1R9jvKPthPKz_U-1YtKS7V2hcJvAVafLo",
  "tenet": "1Khc6iZ-GW-NULyPMgG3OqyUIcYQ5Jmgf",
  "the-chien-z": "1RA9W5aCweJbH-8bRnW9ScFuH07Pis3Y4",
  "the-gioi-vo-hiep-kim-dung": "1UpeF_q4A9AOrd5bPoOtWb44oyAI0GVzo",
  "the-last-castle": "1hnT2qOGQJp8tT--IE4zScWvAocQfrxS4",
  "tinh-han-xan-lan": "1DTIGpixb53zd9Hf7qED3PUlxrTFYlqhC",
  "toi-pham-nhan-ban-2049": "1fi-iz-ckG977dGzFCF2Joo8dnSGqJ7Wo",
  "trai-tim-quai-thu": "1X2gWEX0JWsOCWLgKN3XG_xpdsBAMDvBF",
  "tre-trau-jet-jet-di-xem-mat-nu-chu-tich": "1VmLkrsRSASDmD_ll0hoVTLca2JgvoSly",
  "truong-ca-hanh": "1ZpbHDrmd55CwWox-HF2ueQF9CkYOZV1S",
  "uoc-mo-cua-to-la": "1v1MejKHSrBIiTyZK2o6Z20sQ4BTNcMhs",
  "van-tuong-truyen": "11bH1WPSszGYEXTx3b5mS9qc2TZRLacob",
  "vi-khach-khong-moi-ma-den-trong-bua-tiec-cua-ban-toi": "1J7-JVbb7xWIdEU30O0agP-WP-_v0ItWs",
  "vo-bau-u60-nguy-kich-chong-giu-con-trai-bo-vo": "1PP5UZsorBXJMW4r4pQnOWvHQHgEga6w3",
  "vua-quay-zulu": "1iSgt9cWkzG8PBDoFBc1QJyp6QciG_7gL",
  "xe-cap-cuu": "1ZjscFSkVtdyS17PuWp1LeD-XSmkEMEQ_",
};

export function driveClipCount(): number {
  return FILE_IDS.size;
}

const FILE_IDS = new Set(Object.values(DRIVE_CLIPS));

export function driveFileIdForSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return DRIVE_CLIPS[slug] ?? null;
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`;
}

const HLS_SLUGS = new Set([
  "su-thi-odyssey",
  "ho-den-tu-than",
  "toi-pham-nhan-ban-2049",
  "nguoi-ve-tu-sao-hoa",
  "ban-trai-song-sinh",
]);

export function hlsFileIdForSlug(slug: string | null | undefined): string | null {
  if (!slug || !HLS_SLUGS.has(slug)) return null;
  return DRIVE_CLIPS[slug] ?? null;
}

export function hlsFileIds(): string[] {
  return [...HLS_SLUGS].flatMap((slug) => {
    const fileId = DRIVE_CLIPS[slug];
    return fileId ? [fileId] : [];
  });
}

export function isHlsDriveFile(fileId: string): boolean {
  return hlsFileIds().includes(fileId);
}

export function hlsPlaybackUrl(
  fileId: string,
  expSec: number,
  secret: string,
  webOrigin: string,
): string {
  const origin = webOrigin.replace(/\/$/, "");
  const sig = signDriveTicket(fileId, expSec, secret);
  return `${origin}/api/video/hls/${encodeURIComponent(fileId)}/index.m3u8?exp=${expSec}&sig=${sig}`;
}

export function drivePlaybackUrl(
  fileId: string,
  expSec: number,
  secret: string,
  webOrigin: string,
): string {
  const origin = webOrigin.replace(/\/$/, "");
  const sig = signDriveTicket(fileId, expSec, secret);
  return `${origin}/api/video/drive/${encodeURIComponent(fileId)}?exp=${expSec}&sig=${sig}`;
}

export function acceptDriveTicket(
  fileId: string,
  expRaw: string | undefined,
  sig: string | undefined,
  secret: string,
  now: Date,
): boolean {
  if (!FILE_IDS.has(fileId) || !expRaw || !sig || !/^\d+$/.test(expRaw)) return false;
  const exp = Number(expRaw);
  if (!Number.isSafeInteger(exp) || exp * 1000 <= now.getTime()) return false;
  const expected = signDriveTicket(fileId, exp, secret);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function signDriveTicket(fileId: string, expSec: number, secret: string): string {
  return createHmac("sha256", secret).update(`${fileId}.${expSec}`).digest("base64url");
}
