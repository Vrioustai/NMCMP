# Hướng dẫn cho UI/UX Designer

Tài liệu này dành cho người thiết kế giao diện website xem phim trước khi bàn giao cho frontend developer.

## Figma chung của nhóm

Tạo và quản lý toàn bộ wireframe, UI, prototype và design system tại [Figma workspace của dự án](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391). Đây là nguồn thiết kế chính thức để bàn giao cho frontend developer.

## Nơi lưu từng loại dữ liệu

| Dữ liệu | Nơi lưu |
| --- | --- |
| Wireframe, UI, prototype, component | [Figma của nhóm](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391) |
| File gốc PSD, AI, ảnh raw, video motion | Google Drive của designer |
| Asset web đã duyệt và tối ưu | Gửi cho dev để đặt tại `NMCMP/apps/web/public/assets/` |
| Source code | GitHub; designer không cần đưa file thiết kế gốc vào repo |
| Video/poster/backdrop phim | Google Drive kho phim; không quản lý trong file Figma chính |

Figma là nguồn thiết kế chuẩn. Nếu ảnh xuất hiện khác với Figma, frontend developer cần phản hồi lại trước khi tự điều chỉnh.

## Cấu trúc file Figma chung

```text
00-Foundations       # màu sắc, font, lưới, spacing, shadow
01-Components        # button, input, card, modal, header, navigation
02-Pages-Desktop     # trang desktop
03-Pages-Mobile      # trang mobile
04-Dev-Ready         # màn hình được duyệt, sẵn sàng code
05-Archive           # phiên bản cũ
```

Mỗi frame trong `04-Dev-Ready` nên có tên theo mẫu:

```text
Page / Desktop / Movie Detail
Page / Mobile / Movie Detail
Component / Movie Card / Default
```

## Thiết kế cần bàn giao

Mỗi màn hình phải có đủ:

- Bản desktop và mobile.
- Trạng thái mặc định, hover, focus, disabled nếu có tương tác.
- Loading, dữ liệu trống và lỗi hiển thị.
- Nội dung mẫu đủ dài để phát hiện lỗi tràn chữ.
- Ghi chú hành vi: cuộn trang, popup, filter, pagination, player hoặc chatbot.

Không chỉ bàn giao ảnh chụp màn hình; cần dùng component, auto layout và style/variables nhất quán để developer đo được kích thước chính xác.

## Quy ước màu, font và asset

- Khai báo màu, typography, spacing và radius trong `00-Foundations`.
- Ưu tiên component và variant thay vì copy/paste nhiều phần tử giống nhau.
- Asset xuất cho web dùng SVG với logo/icon; dùng WebP/JPG cho ảnh raster.
- Đặt tên asset chữ thường, dùng dấu `-`: `logo-dark.svg`, `chat-empty-state.webp`.
- Không dùng tên mơ hồ: `final.png`, `final-2.png`, `new-button.svg`.
- Poster phim phải dùng tỉ lệ 2:3; backdrop dùng tỉ lệ 16:9.

## Quy trình bàn giao cho developer

1. Hoàn thiện màn hình trên Figma và tự kiểm tra desktop/mobile.
2. Đưa component đã dùng vào `01-Components`; không để component chỉ tồn tại trong một frame.
3. Chuyển frame đã duyệt vào hoặc gắn nhãn `Dev Ready` trong `04-Dev-Ready`.
4. Gửi link Figma frame, mô tả hành vi và asset xuất cho frontend developer.
5. Tạo/đính kèm issue để dev theo dõi; không thay đổi frame đã bàn giao mà không báo lại.
6. Sau khi dev hoàn thành, đối chiếu website thực tế với Figma và ghi lại các điểm cần chỉnh.

## Checklist trước khi đánh dấu Dev Ready

- [ ] Có desktop và mobile.
- [ ] Có states cần thiết: loading, empty, error, hover/focus.
- [ ] Màu, font, spacing, icon và component được dùng nhất quán.
- [ ] Asset có đúng tên, đúng định dạng và đủ chất lượng.
- [ ] Link frame và ghi chú tương tác sẵn sàng cho developer.
- [ ] Không chứa thông tin nhạy cảm, API key hoặc tài liệu không có quyền sử dụng.
