# FilmGenZ

Website xem phim trực tuyến cho người dùng 13–30 tuổi. Điểm khác biệt là Danmaku: bình luận chạy ngang màn hình, gắn với đúng mốc thời gian của video, có kiểm duyệt và bật, tắt được. Tìm kiếm, bộ lọc và mục phim xu hướng giúp chọn phim nhanh hơn.

## Công nghệ

- `apps/web`: Next.js, React, TypeScript, Tailwind CSS
- `apps/api`: NestJS, Prisma, PostgreSQL, Redis
- `packages/contracts`: kiểu dữ liệu/API contract dùng chung
- `infra`: Docker Compose cho PostgreSQL, Redis và Mailpit

## Chạy local

Yêu cầu: Node.js 22.18 trở lên (máy này dùng 24), pnpm 9.15.9 và Docker. pnpm được ghim trong `package.json`:

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
```

Trên Windows, nếu PowerShell chặn `pnpm.ps1` thì gọi `pnpm.cmd`.

1. Cài phụ thuộc và chép file biến môi trường.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

PowerShell:

```powershell
pnpm.cmd install
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env.local
```

2. Sửa `apps/api/.env` trước khi chạy API. Đặt `JWT_SECRET` bằng một chuỗi ngẫu nhiên ít nhất 32 ký tự, và đặt `COOKIE_SECURE=false` vì trang chạy bằng http. Dòng để trống nghĩa là cookie chỉ đi qua https, trình duyệt ở localhost sẽ không giữ phiên. Giữ `VIDEO_PROVIDER=fake` và `FAKE_HLS_URL` như file mẫu. Không điền khóa Cloudflare trên máy cá nhân.

3. Bật hạ tầng và áp migration đã có trong repo.

```bash
pnpm db:up
pnpm db:migrate
pnpm dev
```

`pnpm db:up` chạy PostgreSQL 16, Redis 7 và Mailpit. Lần đầu, PostgreSQL tạo thêm cơ sở dữ liệu `movie_platform_test` cho test e2e. `pnpm db:migrate` áp các migration đã commit. Script trong `infra/postgres-init/` chỉ chạy khi volume còn trống. Sau khi đổi script đó, chạy `pnpm db:down -v` (xóa dữ liệu trên máy) rồi `pnpm db:up`.

Biến của API, Prisma và script seed nằm ở `apps/api/.env`. Biến của Next.js nằm ở `apps/web/.env.local`. Không có file `.env` ở gốc repo.

Trang chủ mở được khi chưa có phim. `pnpm db:seed` thêm thể loại, quốc gia, từ cấm và một tài khoản quản trị; trước khi chạy phải tự đặt `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` trong `apps/api/.env`. `pnpm db:seed:dev` chỉ dành cho máy cá nhân và từ chối khi `NODE_ENV=production`. `pnpm db:reset` xóa cơ sở dữ liệu rồi tạo lại theo migration.

Kiểm tra trên máy đang phát triển:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Bản có tên miền và HTTPS đọc [docs/demo.md](docs/demo.md). Chưa gắn thẻ phát hành.

Địa chỉ:

- Web: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/api/health
- Mailpit (email gửi ra khi chạy trên máy): http://localhost:8025

Đọc [docs/architecture.md](docs/architecture.md) để biết luồng chính và thứ tự xây 7 module M1–M7.

Người chuẩn bị phim đọc [docs/movie-data-preparation.md](docs/movie-data-preparation.md) trước khi bàn giao dữ liệu.

Tài liệu làm giao diện: [frontend developer](docs/frontend-developer-guide.md) và [UI/UX designer](docs/ui-designer-guide.md).

Figma chung của nhóm: [mở workspace Figma](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391).
