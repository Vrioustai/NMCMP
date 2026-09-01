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
