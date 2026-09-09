# Movie Platform

Monorepo khung cho website xem phim có chatbot tư vấn phim.

## Công nghệ

- `apps/web`: Next.js, React, TypeScript, Tailwind CSS
- `apps/api`: NestJS, Prisma, PostgreSQL, Redis
- `packages/contracts`: kiểu dữ liệu/API contract dùng chung
- `infra`: Docker Compose cho PostgreSQL và Redis

## Chạy local

Yêu cầu: Node.js LTS, pnpm và Docker.

```bash
pnpm install
Copy-Item .env.example .env
pnpm db:up
pnpm db:migrate
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- Health check: http://localhost:4000/api/health

Đọc [docs/architecture.md](docs/architecture.md) để biết thứ tự tự xây các module.

Người chuẩn bị phim đọc [docs/movie-data-preparation.md](docs/movie-data-preparation.md) trước khi bàn giao dữ liệu.

Tài liệu làm giao diện: [frontend developer](docs/frontend-developer-guide.md) và [UI/UX designer](docs/ui-designer-guide.md).

Figma chung của nhóm: [mở workspace Figma](https://www.figma.com/files/team/1679481307353327174/folder/651999589?fuid=1487758876452555391).
