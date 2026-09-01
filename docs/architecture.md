# Kiến trúc và lộ trình xây dựng

## Luồng chính

```text
Next.js (web) -> NestJS REST API -> PostgreSQL (metadata)
                              -> Redis (cache, rate limit)
                              -> Video provider (HLS/CDN)
                              -> OpenAI API (chatbot)
```

API key của OpenAI và khóa ký URL video chỉ được lưu ở backend.

## Thứ tự triển khai

1. Auth và phân quyền `USER/ADMIN`.
2. CRUD phim, thể loại, diễn viên và tập phim trong `movies`.
3. Upload/đồng bộ video với Cloudflare Stream (không lưu file video trong database).
4. Trang danh sách, chi tiết phim và trình phát HLS.
5. Lịch sử xem, yêu thích, đánh giá và bình luận.
6. Chatbot: endpoint `/chat`, tool tìm phim, rồi mới thêm embeddings/pgvector.
7. Cache Redis, rate limiting, logging và monitoring.

## Quy tắc module

- Controller chỉ nhận request và trả response.
- Service chứa nghiệp vụ.
- Prisma chỉ được truy cập từ service/repository.
- `packages/contracts` là nơi đặt DTO/schema mà web và API cùng dùng.
