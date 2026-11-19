# Hướng dẫn chuẩn bị dữ liệu phim

Tài liệu này dành cho người chuẩn bị dữ liệu trước khi phim được đưa lên hệ thống. Chỉ sử dụng nội dung mà nhóm có quyền phân phối.

## Kho dữ liệu chung của nhóm

Video gốc, poster, backdrop và phụ đề được chia sẻ qua Google Drive chung của dự án. Đường dẫn thư mục chỉ gửi trong nhóm, không ghi vào repository vì repository đang công khai. GitHub chỉ lưu source code, tài liệu và mẫu dữ liệu; không lưu video.

Trong Google Drive, dùng các thư mục sau:

```text
NMCMP-Movie-Assets/
├── 01-incoming/       # File mới được đưa vào, chưa kiểm tra
├── 02-approved/       # Đã kiểm tra, sẵn sàng upload lên hệ thống
├── 03-uploaded/       # Đã upload; giữ lại nguồn gốc để đối chiếu
└── templates/         # Mẫu metadata và asset tham khảo
```

Mỗi thành viên chỉ tải các phim mình được phân công. Nếu cần cập nhật dữ liệu, upload lại đúng thư mục phim trên Drive; không gửi video qua GitHub, tin nhắn hoặc email.

## Nơi lưu file tạm thời

Khi làm trên máy local, đặt dữ liệu ở:

```text
NMCMP/data/incoming-videos/
```

Thư mục này đã được bỏ qua bởi Git. Không đưa file video, phụ đề hay poster dung lượng lớn lên repository.

Nên tải hoặc đồng bộ dữ liệu Drive vào một thư mục ngoài repository, ví dụ `D:\NMCMP-Movie-Assets\`, sau đó copy phim đang xử lý vào `NMCMP/data/incoming-videos/`. Cách này tránh việc Drive đồng bộ và Git cùng thao tác trong một thư mục.

Khi thư mục phim đã đúng bố cục bên dưới, chạy script nhập. Script luôn ghi phim ở trạng thái nháp, kể cả khi metadata ghi trạng thái khác. Mã video lưu vào cột `stream_uid` của tập.

Máy đang đặt nhà cung cấp video giả thì script không gửi file đi đâu. Máy đặt nhà cung cấp thật thì script gọi cùng hai lệnh tải mà API dùng, và cả hai đều bật đường dẫn có chữ ký.

## Cấu trúc thư mục

Mỗi phim dùng một thư mục theo `slug` viết thường, không dấu, các từ ngăn cách bằng dấu gạch ngang.

```text
data/incoming-videos/
└── ten-phim-khong-dau/
    ├── metadata.json
    ├── poster.jpg
    ├── backdrop.jpg
    ├── movie.mp4                    # Phim lẻ
    ├── movie.vi.vtt                 # Phụ đề tiếng Việt, nếu có
    └── season-01/                   # Chỉ dùng cho phim bộ
        ├── episode-01.mp4
        ├── episode-01.vi.vtt
        ├── episode-02.mp4
        └── episode-02.vi.vtt
```

Không đặt đồng thời `movie.mp4` và thư mục `season-*` trong cùng một phim.

## Quy tắc đặt tên

Các tên này áp dụng giống nhau trên Google Drive và trong `NMCMP/data/incoming-videos/`. Đây là quy ước bắt buộc để script import dữ liệu có thể hoạt động chính xác.

| Thành phần | Quy tắc | Ví dụ |
| --- | --- | --- |
| Thư mục phim | `slug`, chữ thường, không dấu, dùng dấu `-` | `nha-gia-tien` |
| Phim lẻ | `movie.mp4` | `movie.mp4` |
| Mùa phim bộ | `season-01` | `season-02` |
| Tập phim | `episode-01.mp4` | `episode-12.mp4` |
| Phụ đề phim lẻ | `movie.<ngon-ngu>.vtt` | `movie.vi.vtt` |
| Phụ đề tập phim | cùng tên video + mã ngôn ngữ | `episode-01.vi.vtt` |
| Poster | `poster.jpg` | `poster.jpg` |
| Ảnh nền | `backdrop.jpg` | `backdrop.jpg` |

Chỉ dùng chữ cái Latin thường (`a-z`), số (`0-9`) và dấu gạch ngang (`-`) trong `slug`. Không dùng dấu tiếng Việt, khoảng trắng, ký tự đặc biệt hoặc các tên mơ hồ như `final.mp4`, `new.mp4`, `movie moi.mp4`.

Ví dụ đúng cho phim lẻ:

```text
01-incoming/nha-gia-tien/
├── metadata.json            # slug: nha-gia-tien
├── poster.jpg
├── backdrop.jpg
├── movie.mp4
└── movie.vi.vtt
```

Ví dụ đúng cho phim bộ:

```text
01-incoming/ten-phim-bo/
├── metadata.json            # slug: ten-phim-bo
├── poster.jpg
└── season-01/
    ├── episode-01.mp4
    ├── episode-01.vi.vtt
    ├── episode-02.mp4
    └── episode-02.vi.vtt
```

## File metadata bắt buộc

Tạo `metadata.json` trong thư mục phim theo mẫu sau. Điền dữ liệu đúng với nội dung được cấp quyền sử dụng.

```json
{
  "title": "Tên phim hiển thị",
  "originalTitle": "Tên gốc (nếu có)",
  "slug": "ten-phim-khong-dau",
  "type": "MOVIE",
  "releaseYear": 2026,
  "description": "Mô tả ngắn, không tiết lộ nội dung quan trọng.",
  "genres": ["Hành động", "Phiêu lưu"],
  "countries": ["Việt Nam"],
  "directors": ["Tên đạo diễn"],
  "cast": ["Diễn viên A", "Diễn viên B"],
  "ageRating": "T13",
  "source": "https://trang-goc-cua-phim",
  "license": "Được chia sẻ cho nhóm dùng trong bản demo",
  "trailerUrl": "https://...",
  "videoUrl": "https://cdn.example/phim.mp4"
}
```

Với phim bộ, đổi `type` thành `SERIES` và thêm danh sách mùa/tập:

```json
{
  "title": "Tên phim bộ",
  "slug": "ten-phim-bo",
  "type": "SERIES",
  "releaseYear": 2026,
  "description": "Mô tả phim.",
  "genres": ["Tâm lý"],
  "seasons": [
    {
      "number": 1,
      "episodes": [
        { "number": 1, "title": "Tập 1" },
        { "number": 2, "title": "Tập 2" }
      ]
    }
  ]
}
```

## Yêu cầu file media

- Video: ưu tiên MP4 với video H.264/H.265 và âm thanh AAC; không đặt mật khẩu file.
- Poster: JPG hoặc WebP, dọc, chất lượng tốt; đề xuất tỉ lệ 2:3.
- Backdrop: JPG hoặc WebP, ngang; đề xuất tỉ lệ 16:9.
- Phụ đề: WebVTT (`.vtt`) mã hóa UTF-8; kiểm tra tiếng Việt không bị lỗi dấu.
- Không tự tạo link phát trực tiếp. Hệ thống video sẽ tạo HLS và CDN sau khi upload.

## Checklist trước khi bàn giao

- [ ] Slug trong `metadata.json` trùng tên thư mục.
- [ ] Phim lẻ có `movie.mp4`; phim bộ có đúng các thư mục `season-*` và `episode-*`.
- [ ] Mở thử đầu, giữa và cuối của từng video; âm thanh và hình ảnh khớp nhau.
- [ ] Số tập trong `metadata.json` khớp file thực tế.
- [ ] Poster/backdrop đúng phim, không bị vỡ hoặc lẫn nội dung không liên quan.
- [ ] Phụ đề khớp thời gian và hiển thị tiếng Việt đúng.
- [ ] Metadata không để trống `title`, `slug`, `type`, `description`, `releaseYear`, `genres`, `source` và `license`.
- [ ] `source` là URL trang gốc. `license` ghi điều kiện được dùng. Phim lấy từ kho `Data/` ghi đúng câu “Được chia sẻ cho nhóm dùng trong bản demo”.
- [ ] Nhóm đã xác nhận quyền sử dụng/phân phối nội dung.

`status` trong metadata, nếu có, bị bỏ qua. Script luôn nhập nháp.

`videoUrl` là tùy chọn. Chỉ dùng khi file nặng hơn 200 MB và đó là link `https` tải thẳng file, không phải trang xem. Link `drive.google.com` và `docs.google.com` bị từ chối.

## Chép phim từ kho Data

Kho `Data/` trên Drive chưa theo bố cục của script. Mỗi thể loại nằm ở ba chỗ:

- `<thể loại>/` — mỗi phim một thư mục con, bên trong là một file `.mp4`
- `<thể loại>.js/` — metadata của các phim thuộc thể loại đó
- `<thể loại>_poster/` — poster

Chép từng phim được chọn sang một thư mục ngoài repository, theo đúng bố cục `<slug>/` ở trên: một `metadata.json`, poster thành `poster.jpg`, video thành `movie.mp4` hoặc `season-XX/episode-YY.mp4`, phụ đề tiếng Việt thành `movie.vi.vtt` hoặc `episode-YY.vi.vtt`. Điền `source`, `license`, và `trailerUrl` nếu có. Không để thư mục này trong Git.

## Chạy script

Từ thư mục gốc của repository:

```text
pnpm --filter @movie/api import:movies -- --dir <thư mục> [--dry-run] [--only <slug>] [--max <n>]
```

`--max` mặc định là 20. Vượt số đó thì script dừng trước khi ghi, mã thoát 3.

Thứ tự an toàn: `--dry-run`, rồi `--only <slug>` cho một phim, rồi cả thư mục. `--dry-run` chỉ in, không ghi cơ sở dữ liệu và không gọi nhà cung cấp video.

Cuối lần chạy in số phim tạo, số phim cập nhật, và từng phim bị bỏ qua kèm lý do. Thiếu `source` hoặc `license` thì bỏ qua phim đó.

Nhật ký `import-journal.json` nằm ở thư mục người dùng `.filmgenz`, ngoài repository. Trước khi tải một tập, script ghi `IN_FLIGHT`. Có mã video thì ghi `UPLOADED`. Ghi cơ sở dữ liệu xong thì ghi `DONE`. Tập đã có `stream_uid` thì không tải lại. Gặp `IN_FLIGHT` thì cả lần chạy dừng, mã thoát 3: lần trước có thể đã gửi video mà mất câu trả lời, cần tìm theo tên `<slug>/s<mùa>e<tập>` rồi mới chạy tiếp. Gặp `UPLOADED` thì chỉ ghi mã vào cơ sở dữ liệu.

Mã thoát: 0 xong; 1 lỗi trước khi ghi gì; 2 đã ghi một phần; 3 dừng vì `IN_FLIGHT` hoặc vượt `--max`.

## Bàn giao

Gửi cho người phụ trách kỹ thuật đường dẫn thư mục phim đã hoàn chỉnh, ví dụ:

```text
NMCMP/data/incoming-videos/ten-phim-khong-dau/
```

Không gửi video qua Git. Người phụ trách kỹ thuật chạy script nhập ở mục sau, kiểm phim nháp trên trang quản trị, rồi mới công khai.

## Quy trình làm việc với Google Drive

1. Xem phim được giao trong thư mục `01-incoming/` trên Google Drive chung.
2. Tải thư mục phim về máy, kiểm tra video và hoàn thiện `metadata.json`, ảnh, phụ đề nếu được phân công.
3. Chạy/kiểm tra local bằng bản nằm trong `NMCMP/data/incoming-videos/<slug>/`.
4. Upload dữ liệu đã hoàn thiện lên đúng thư mục phim trong `02-approved/` trên Drive.
5. Báo người phụ trách kỹ thuật tên phim và đường dẫn Drive. Không ghi đè file của phim mà người khác đang xử lý.
6. Sau khi upload Cloudflare Stream thành công, người phụ trách chuyển hoặc đánh dấu dữ liệu trong `03-uploaded/`.
