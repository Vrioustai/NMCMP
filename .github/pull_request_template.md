## Làm gì
-

## Vì sao
Closes #
<!-- Mã FR/NFR, mã UC -->

## Đã kiểm thế nào
<!-- Lệnh đã chạy, số test đạt và không đạt. Phần chưa chạy thì ghi "chưa chạy". Đã gọi thử API hay mở thử trang thì ghi ở đâu. -->
-

## Rủi ro
<!-- Hành vi nào đổi, module nào bị ảnh hưởng, có đổi schema hay API không -->
-

## Chưa làm
-

## Tự kiểm

**Diff**
- [ ] Không có `.env`, khóa API, mật khẩu hay token trong diff.
- [ ] Không có thay đổi lạc đề ở `package.json`, `pnpm-lock.yaml`, cấu hình Docker; không còn `console.log` gỡ lỗi.
- [ ] Commit và mô tả PR không có dòng ký tên tự động.

**Dữ liệu (Prisma, PostgreSQL)**
- [ ] Đổi schema thì có migration mới; không sửa migration đã merge.
- [ ] Ràng buộc CHECK và SQL riêng của PostgreSQL được kiểm trên PostgreSQL thật.
- [ ] Bấm hai lần không tạo bản ghi trùng (ràng buộc unique kết hợp `upsert`).
- [ ] Bộ đếm tăng bằng `increment`, không đọc lên rồi ghi lại.
- [ ] Không gọi dịch vụ ngoài bên trong `prisma.$transaction`.
- [ ] API trả danh sách có `orderBy` ổn định.

**Bảo mật và lỗi**
- [ ] Kiểm quyền ở backend bằng guard theo vai trò, không chỉ ẩn nút.
- [ ] Log không chứa mật khẩu, token, mã đặt lại mật khẩu hay email đầy đủ.
- [ ] Redis lỗi thì ghi cảnh báo và chạy tiếp, không treo request.
- [ ] Mỗi thao tác dùng một mốc `now`; hạn của mã có test với thời gian giả lập.

**Test và bằng chứng**
- [ ] Có ít nhất 1 test cho trường hợp đúng và 1–2 test cho trường hợp biên.
- [ ] Tên test nói rõ tình huống và kết quả; test kiểm một test case thì bắt đầu bằng mã `TEST_…`.
- [ ] Thay đổi giao diện có ảnh chụp ở độ rộng 360 và 1366 px.
