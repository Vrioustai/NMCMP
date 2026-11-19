# Bản demo

Nơi chạy có tên miền và HTTPS chưa được chọn. File này chỉ là cách gắn khi đã có máy và tên miền. Máy cá nhân vẫn dùng `pnpm dev`, video giả, và không đi qua proxy này.

## Proxy

`infra/Caddyfile` đưa `/api`, `/media` và `/socket.io` tới API cổng 4000, mọi đường còn lại tới web cổng 3000. Caddy tự xin chứng chỉ khi `DEMO_HOST` là tên miền thật trỏ tới máy.

```bash
DEMO_HOST=phim.example caddy run --config infra/Caddyfile
```

Trên bản demo, `NEXT_PUBLIC_SOCKET_URL` để trống để Danmaku đi cùng tên miền. `WEB_ORIGIN` là `https://` cộng tên miền đó. `COOKIE_SECURE` bật. `MEDIA_DIR` là một thư mục trên ổ đĩa của máy, không phải thư mục mất khi container tắt.

## Cơ sở dữ liệu

Trước mỗi lần `prisma migrate deploy` lên bản demo, chạy `pg_dump` của chính cơ sở dữ liệu đó và giữ file ở ngoài repository. Prisma không có migration lùi.

Chưa dump và chưa deploy lên bản demo. Cơ sở dữ liệu đang chạy trên máy này không bị nạp catalog mẫu.

## Phim và ảnh

Chưa nhập bộ phim thật, chưa công khai, chưa chụp ảnh màn hình vào `NMCNPM/hinh/`. Trang chủ đang phục vụ vẫn chưa có poster.
