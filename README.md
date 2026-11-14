# FilmGenZ

Website xem phim trực tuyến cho người dùng 13–30 tuổi. Điểm khác biệt là Danmaku: bình luận chạy ngang màn hình, gắn với đúng mốc thời gian của video, có kiểm duyệt và bật, tắt được. Tìm kiếm, bộ lọc và mục phim xu hướng giúp chọn phim nhanh hơn.

## Công nghệ

- `apps/web`: Next.js, React, TypeScript, Tailwind CSS
- `apps/api`: NestJS, Prisma, PostgreSQL, Redis
- `packages/contracts`: kiểu dữ liệu/API contract dùng chung
- `infra`: Docker Compose cho PostgreSQL, Redis và Mailpit

## Chạy local

Yêu cầu: Node.js 22.18 trở lên (khuyên dùng 24 LTS), pnpm 9.15.9 (`npm install -g pnpm@9.15.9`) và Docker.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up
pnpm db:migrate
pnpm dev
```

Trên PowerShell dùng `Copy-Item` thay cho `cp`.

- Biến của API, Prisma và script seed nằm ở `apps/api/.env`; biến của Next.js nằm ở `apps/web/.env.local`. Không có file `.env` ở gốc repo.
- Trong `apps/api/.env`, đặt `JWT_SECRET` (chuỗi ngẫu nhiên ít nhất 32 ký tự) và `COOKIE_SECURE=false` khi chạy bằng http trên máy.
- `pnpm db:up` chạy PostgreSQL 16, Redis 7 và Mailpit. Lần đầu, PostgreSQL tạo thêm CSDL `movie_platform_test` cho test e2e.
- Script trong `infra/postgres-init/` chỉ chạy khi volume còn trống. Sau khi đổi script, chạy `pnpm db:down -v` (xóa dữ liệu trên máy) rồi `pnpm db:up`.
- `pnpm db:reset` xóa và tạo lại CSDL theo migration rồi chạy seed; `pnpm db:seed` thêm tài khoản quản trị và dữ liệu cố định; `pnpm db:seed:dev` thêm dữ liệu kiểm thử (chỉ trên máy cá nhân).

Địa chỉ:

- Web: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/api/health
- Mailpit (email gửi ra khi chạy trên máy): http://localhost:8025

Đọc [docs/architecture.md](docs/architecture.md) để biết luồng chính và thứ tự xây 7 module M1–M7.

Người chuẩn bị phim đọc [docs/movie-data-preparation.md](docs/movie-data-preparation.md) trước khi bàn giao dữ liệu.

Tài liệu làm giao diện: [frontend developer](docs/frontend-developer-guide.md) và [UI/UX designer](docs/ui-designer-guide.md).

Figma chung của nhóm: [mở workspace Figma](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391).
