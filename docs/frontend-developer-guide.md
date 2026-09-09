# Hướng dẫn cho Frontend Developer

Tài liệu này dành cho người triển khai giao diện website xem phim bằng Next.js trong `NMCMP/apps/web/`.

## Figma chung của nhóm

Thiết kế và bàn giao giao diện nằm tại [Figma workspace của dự án](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391). Luôn lấy frame được đánh dấu `Dev Ready` trong Figma làm nguồn đối chiếu trước khi triển khai.

## Phạm vi công việc

- Chuyển màn hình đã duyệt trên Figma thành giao diện responsive.
- Gọi API từ NestJS và xử lý loading, lỗi, dữ liệu trống.
- Bảo đảm giao diện hoạt động trên desktop và mobile.
- Không tự thay đổi thiết kế đã duyệt; trao đổi với designer nếu có điểm thiếu hoặc không khả thi.

## Nơi lưu từng loại dữ liệu

| Dữ liệu | Nơi lưu |
| --- | --- |
| Code frontend | `NMCMP/apps/web/` và GitHub |
| Thiết kế, prototype, thông số UI | [Figma của nhóm](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391) |
| Logo/icon/ảnh UI đã tối ưu cho web | `NMCMP/apps/web/public/assets/` |
| File thiết kế gốc lớn (PSD, AI, motion) | Google Drive của designer |
| Video, poster và backdrop của phim | Google Drive kho phim; xem `docs/movie-data-preparation.md` |

Không đưa API key, video, file PSD/AI, hoặc dữ liệu phim dung lượng lớn vào GitHub.

## Trước khi bắt đầu một màn hình

1. Xem frame trong Figma và bảo đảm nó được đánh dấu `Dev Ready`.
2. Kiểm tra đủ trạng thái: loading, empty, error, hover, mobile và desktop.
3. Lấy link frame Figma và gắn vào issue/PR tương ứng.
4. Xác định endpoint API cần dùng; nếu chưa có, trao đổi với backend developer trước khi code mock lâu dài.

## Quy ước code

```text
apps/web/
├── app/                 # Route và page của Next.js
├── components/          # Component dùng lại
├── features/            # Component/logic theo nghiệp vụ: movies, auth, chat
├── lib/                 # API client, helper, cấu hình
└── public/assets/       # Asset tĩnh đã tối ưu
```

- Dùng TypeScript; không dùng `any` nếu có thể định nghĩa type.
- Đặt tên component PascalCase: `MovieCard.tsx`, `VideoPlayer.tsx`.
- Đặt tên file asset chữ thường, dùng dấu `-`: `logo-dark.svg`, `empty-watchlist.webp`.
- Không đặt poster phim hàng loạt trong `public`; poster được lấy từ URL trong API/database.
- Tách component nhỏ khi có thể tái sử dụng; không nhồi toàn bộ UI vào một file `page.tsx`.

## Làm việc với GitHub

Tạo branch theo mẫu:

```text
feature/movie-detail-page
fix/mobile-navigation
chore/update-ui-assets
```

Mỗi pull request nên có:

- Link issue hoặc mô tả mục tiêu.
- Link frame Figma được triển khai.
- Ảnh chụp desktop và mobile.
- Ghi chú API chưa hoàn chỉnh hoặc điểm cần designer/backend xác nhận.

Không commit trực tiếp lên nhánh chính khi làm tính năng mới.

## Checklist trước khi bàn giao

- [ ] Khớp layout, font, màu sắc, spacing và trạng thái trong Figma.
- [ ] Kiểm tra màn hình nhỏ và màn hình lớn.
- [ ] Không có text bị tràn, ảnh vỡ hoặc lỗi console.
- [ ] Có loading, empty state và error state.
- [ ] Asset được tối ưu và đặt đúng `public/assets/`.
- [ ] Không có key/secret trong code hoặc file commit.
- [ ] Pull request có ảnh minh họa và link Figma.
