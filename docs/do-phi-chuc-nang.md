# Đo các ngưỡng phi chức năng

Đo trên máy cá nhân, API đang chạy, Redis và PostgreSQL đang chạy. Ghi đúng số máy in ra. Không làm tròn một số vượt ngưỡng thành số đạt.

Mỗi file kết quả cần có ngày đo và cấu hình máy: hệ điều hành, CPU, RAM, phiên bản Node, phiên bản image k6 nếu có dùng.

## Tìm kiếm và lọc

Ngưỡng: 50 người dùng ảo, p95 của tìm kiếm và của lọc đều không quá 2 giây.

Script nằm ở `tests/load/search.k6.js`. Mỗi vòng một người gọi `GET /api/movies?q=phim` rồi `GET /api/movies` với thể loại, quốc gia và năm 2020, nghỉ 1 giây. Kịch bản giữ 50 người trong 30 giây. Thể loại và quốc gia lấy từ API lúc bắt đầu; nếu danh sách trống thì dùng mã 1, lúc đó bộ lọc không khớp dòng nào.

Trong container, API trên máy là `http://host.docker.internal:4000`.

```bash
docker run --rm -i grafana/k6:2.3.0 run - < tests/load/search.k6.js
```

Trên PowerShell, lệnh chuyển hướng của bash không dùng được. Đưa file vào stdin bằng `cmd`:

```bat
cmd /c "docker run --rm -i -e API_URL=http://host.docker.internal:4000 grafana/k6:2.3.0 run - < tests\load\search.k6.js"
```

Đổi `API_URL` khi API không lắng nghe cổng 4000. k6 trả mã thoát khác 0 khi p95 vượt 2 giây hoặc khi hơn 1% request lỗi.

## Danmaku

Ngưỡng: 200 kết nối, p95 từ lúc một người gửi đến lúc những người còn lại nhận không quá 500 ms.

Script nằm ở `apps/api/test/load/danmaku-latency.ts` vì `tsx` và `socket.io-client` chỉ được cài ở đó. k6 không nói giao thức Socket.IO.

Cần một tập đã công khai và cookie phiên `fgz_session` của một tài khoản đủ tuổi với tập đó. Không ghi cookie vào file kết quả.

```bash
pnpm --filter @movie/api exec tsx test/load/danmaku-latency.ts
```

Biến môi trường:

| Tên           | Mặc định                | Ý nghĩa                                             |
| :------------ | :---------------------- | :-------------------------------------------------- |
| `API_URL`     | `http://127.0.0.1:4000` | API đang đo                                         |
| `WEB_ORIGIN`  | đọc từ `.env` của API   | Đúng giá trị API đang kiểm. Dấu `/` cuối được bỏ    |
| `EPISODE_ID`  | không có                | Mã tập                                              |
| `COOKIE`      | không có                | Giá trị `fgz_session`, không gồm tên cookie         |
| `CONNECTIONS` | 200                     | Số kết nối. Một kết nối là người gửi                |
| `SAMPLES`     | 20                      | Số lần gửi. Mỗi tài khoản phải cách nhau hơn 3 giây |

Script in `p95_ms`, `max_ms`, `received`, `missed` và `result`. `result: fail` khi còn tin chưa tới, hoặc p95 trên 500. Cách lấy p95 là hạng gần nhất: sắp thời gian tăng dần, lấy vị trí `ceil(0,95 × số mẫu) − 1`. Số in ra có một chữ số thập phân; so ngưỡng dùng số chưa làm tròn.

Mỗi socket được mở riêng. Nếu không, thư viện gộp hết vào một kết nối và phép đo không còn là 200 kết nối.

## Trang chủ

Ngưỡng: Lighthouse chế độ mobile, trang chủ, LCP không quá 2,5 giây.

Đo khi trang chủ đã có poster. Mở Chrome, trang chủ, DevTools, bảng Lighthouse, mục Navigation, thiết bị Mobile, bấm Analyze. Ghi LCP đúng số trên báo cáo, kèm ngày và cấu hình máy.

## Thời gian bắt đầu phát

Ngưỡng: từ lúc bấm phát đến khi video bắt đầu phát không quá 3 giây. Phiếu đo 10 lần trên mạng giả lập 10 Mbps.

Mở tập bằng đường dẫn có `?measure=1`. Bấm phát. Console in một dòng `NFR04` rồi số mili giây. Ghi đủ 10 số. Phiếu yêu cầu mạng giả lập 10 Mbps. Ghi trong file kết quả khi máy đang dùng nhà cung cấp video giả.

## Độ bao phủ

Ngưỡng: câu lệnh và nhánh của các file `*.service.ts` đều từ 60% trở lên.

```bash
pnpm --filter @movie/api test
```

Lấy bốn số Statements, Branches, Functions, Lines ở cuối bảng coverage. Không hạ ngưỡng trong `apps/api/jest.config.ts` để làm số đẹp hơn.

## Bốn trình duyệt và bốn độ rộng

Phiếu này là Chrome, Edge, Firefox và Safari, mỗi trình duyệt ở 360, 768, 1366 và 1920 px. Mỗi ô ghi Đạt hoặc Không đạt, kèm ảnh. Trong console, `document.documentElement.scrollWidth <= innerWidth` phải ra `true`. Safari không có trên máy Windows này, nên bảng để trống cho đến khi đo đủ tám cặp trình duyệt.
