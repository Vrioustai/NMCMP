# Biên bản rà soát kỹ thuật

- Ngày: 19/11/2026
- Người kiểm: V1
- Người kiểm lại: V1, sau ít nhất một buổi
- Phạm vi: cảnh báo High của `pnpm audit`, route quản trị, API nhận mã của phim nháp, khóa trong mã nguồn và bundle web, header chống nhúng khung
- Chưa đẩy file lên GitHub, nên Dependabot và CodeQL chưa chạy lần quét đầu. Cổng K4 chưa đạt: còn thiếu lần đo Lighthouse, thời gian bắt đầu phát, và bảng bốn trình duyệt.

## Công cụ đã bật trong cây mã

- `.github/dependabot.yml`: npm và GitHub Actions, mỗi tuần
- `.github/workflows/codeql.yml`: JavaScript và TypeScript, khi mở PR, khi đẩy `main`, và mỗi thứ Hai

## pnpm audit

Lệnh chạy ngày 19/11/2026 trên máy Windows 11, Node v24.21.0. 992 phụ thuộc. 0 critical. 3 advisory High. 4 advisory moderate. Không nâng phiên bản trong lát này: bản sửa nằm ở thư viện kéo theo, spec yêu cầu nâng trong PR riêng, và Prisma giữ ở dòng 6.

### High

**deepmerge-ts, advisory 1145093.** Phiên bản 7.1.5, kéo từ `@prisma/client` 6.19.3 qua `prisma` và `@prisma/config`. Bản vá là 8.0.0 trở lên. Điều kiện của cảnh báo là gộp một đồ thị đối tượng tự gọi lại thì tràn stack. Mã ứng dụng không import `deepmerge-ts`. Đường này chỉ có trong công cụ Prisma, không có route HTTP nào đưa dữ liệu người dùng vào hàm đó. Kết luận: chấp nhận rủi ro. Mức bằng chứng L2, test `advisory-reach.spec.ts`. Không làm được L3 vì không có API để gọi. Kết luận còn đúng chừng nào ứng dụng không tự gọi `deepmerge-ts` và người dùng không sửa được file cấu hình Prisma.

**postcss, advisory 1124252 và 1139510.** Phiên bản 8.4.31, kéo từ `next` 15.5.29. Bản vá lần lượt là 8.5.12 và 8.5.18 trở lên. Cảnh báo nói file CSS có `sourceMappingURL` do kẻ tấn công kiểm soát thì PostCSS đọc file ngoài ý muốn. PostCSS chạy lúc Next biên dịch CSS của repository. Mã ứng dụng không import `postcss`. Người xem không tải CSS lên. Kết luận: chấp nhận rủi ro. Mức bằng chứng L2, cùng test `advisory-reach.spec.ts`. Không làm được L3 vì không có API nhận CSS. Kết luận còn đúng chừng nào stylesheet chỉ đến từ mã nguồn và Next vẫn chỉ dùng PostCSS lúc build.

### Moderate, chưa thuộc ngưỡng phải kết luận từng ý

- postcss 1117015 và 1130709, cùng đường `next` 15.5.29
- glob 1244013, qua `@nestjs/cli` và Jest
- minimatch 1244623, qua ESLint và Jest

## Kịch bản

| Mã | Việc đã kiểm | Mức | Test |
| :-- | :-- | :-- | :-- |
| A1 | 28 route `/api/admin` lấy từ ứng dụng, tài khoản thành viên đều nhận 403 `FORBIDDEN` | L3 | `security-review.e2e-spec.ts`, TEST_NFR08 |
| A2 | Người 17 tuổi không phát được phim T18 | L3 | `playback.e2e-spec.ts`, TEST_UC07_06 |
| A3 | Phim nháp: phát, Danmaku, đánh giá, bình luận, trạng thái, yêu thích, lịch sử, báo cáo, chi tiết, vào phòng | L3 | `security-review.e2e-spec.ts` |
| A4 | Lịch sử từ chối tập nháp và tập T18 với người 17 tuổi | L3 | `history.e2e-spec.ts` |
| A5 | Hai file vẽ Danmaku gán `textContent`, không có `innerHTML` | L2 | `untrusted-text.test.ts`. Chưa render trên trình duyệt |
| A6 | Origin lạ bị từ chối ở REST và cổng Danmaku | L3 | `origin.e2e-spec.ts`, `danmaku.e2e-spec.ts` |
| A7 | Gửi dày thì bị giới hạn, kể cả khi Redis lỗi | L3 | `danmaku.e2e-spec.ts` |
| A8 | Cookie cũ bị từ chối sau khi mật khẩu đổi | L3 | `auth.e2e-spec.ts` |
| A9 | Không thấy khóa riêng, khóa AWS, JWK riêng, token GitHub hay Stripe trong mã nguồn. Bundle `apps/web/.next/static` cũng không có. Web không chứa tên khóa video | L2 | `repo-secrets.spec.ts`, TEST_UC07_08 |
| A10 | Báo cáo lần hai trả 409, Danmaku đã ẩn trả 404 | L3 | `reports.e2e-spec.ts` |
| A11 | `next` từ chối `//x`, `/\x`, `http://x`, `javascript:` | L2 | `safe-next.test.ts` |
| A12 | Quên mật khẩu trả 202 và cùng nội dung dù email có hay không | L3 | `password-reset.e2e-spec.ts` |
| A13 | Trang `/` và `/admin` đều có `X-Frame-Options: DENY` và `frame-ancestors 'none'`. API health có helmet, `X-Frame-Options: SAMEORIGIN` | L3 | `curl -I` ngày 19/11/2026 |

`/admin` trả 307 về trang đăng nhập và vẫn gửi header chống nhúng khung.

## Điều chưa làm

Chưa tạo PR nâng `deepmerge-ts` hay `postcss`. Chưa commit. Chưa điền phụ lục của báo cáo môn học.
