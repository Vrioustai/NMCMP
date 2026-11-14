# Kiến trúc và lộ trình xây dựng

## Luồng chính

```text
Trình duyệt -> Next.js (web) -> NestJS API: REST /api/*
Trình duyệt -> NestJS API: WebSocket (Danmaku)
Trình duyệt -> CDN của Cloudflare Stream: video HLS, tải bằng URL có chữ ký

NestJS API -> PostgreSQL (dữ liệu chính)
           -> Redis (bộ nhớ đệm, giới hạn tần suất gửi Danmaku)
           -> Cloudflare Stream API (tải video lên, lấy thông tin video)
           -> SMTP (email đặt lại mật khẩu; khi phát triển dùng Mailpit)
```

Video không đi qua API. Khi người xem mở một tập phim, API kiểm tra đăng nhập và nhãn độ tuổi rồi cấp một URL có chữ ký; trình duyệt dùng URL đó để tải video thẳng từ CDN.

Khóa ký URL video, API token của Cloudflare và mật khẩu SMTP chỉ nằm ở backend, trong `.env` trên máy chạy API. Không đưa vào code hay commit.

## Thứ tự triển khai

Mỗi module ứng với một nhóm chức năng của hệ thống.

| Sprint | Module | Backend (`apps/api/src/`) | Trang (`apps/web/app/`) |
| :-- | :-- | :-- | :-- |
| 1 | Nền móng | `config`, `common`, `prisma`, `redis`, `health` | Layout chung, trang 404 và trang lỗi |
| 2 | M1 Quản lý tài khoản | `auth`, `users`, `mail` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/me` |
| 2 | M6 Quản trị nội dung | `admin/movies`, `admin/genres`, `video` | `/admin/movies`, `/admin/genres` |
| 3 | M2 Khám phá phim | `movies`, `genres`, `countries` | `/`, `/search`, `/movies/[slug]` |
| 3 | M3 Xem phim | `episodes`, `history` | `/watch/…` (trình phát) |
| 3 | M4 Tương tác Danmaku | `danmaku`, `reports` | Lớp Danmaku trên trình phát |
| 4 | M5 Quản lý cá nhân | `ratings`, `comments`, `favorites`, `history` | `/movies/[slug]`, `/me/favorites`, `/me/history` |
| 4 | M7 Quản trị hệ thống | `admin/users`, `moderation`, `stats` | `/admin`, `/admin/users`, `/admin/reports`, `/admin/banned-words` |
| 5 | Sửa lỗi, đóng gói | — | — |

## Quy tắc module

- Controller (REST) và gateway (WebSocket) chỉ nhận request, kiểm tra DTO và trả response.
- Service chứa nghiệp vụ.
- Prisma và Redis chỉ được gọi từ service.
- `packages/contracts` là nơi đặt kiểu dữ liệu và DTO mà web và API cùng dùng.
