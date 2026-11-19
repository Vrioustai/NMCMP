"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { AgeBadge, type AgeRating } from "../movie/age-badge";
import { MovieGrid, type MovieCardData } from "../movie/movie-grid";
import { MovieRail } from "../movie/movie-rail";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Chip } from "../ui/chip";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Dialog } from "../ui/dialog";
import { Drawer } from "../ui/drawer";
import { EmptyState } from "../ui/empty-state";
import { ErrorState } from "../ui/error-state";
import { IconButton } from "../ui/icon-button";
import { Input } from "../ui/input";
import { Pagination } from "../ui/pagination";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { Slider } from "../ui/slider";
import { Spinner } from "../ui/spinner";
import { Switch } from "../ui/switch";
import { Tabs } from "../ui/tabs";
import { useToast } from "../ui/toast";

const SAMPLE: MovieCardData[] = ["P", "K", "T13", "T16", "T18", "P"].map((rating, index) => ({
  id: String(index + 1),
  title: `Tên phim ${index + 1}`,
  year: 2024,
  rating: rating as AgeRating,
  href: "/search",
}));

export function UiGallery() {
  const [tab, setTab] = useState("all");
  const [on, setOn] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [page, setPage] = useState(1);
  const toast = useToast();

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-5xl gap-10 px-4 py-8">
      <h1 className="text-[28px] font-extrabold">Bộ component</h1>
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Nút</h2>
        <div className="flex flex-wrap gap-3">
          <Button>Chính</Button>
          <Button variant="secondary">Phụ</Button>
          <Button variant="danger">Xóa</Button>
          <Button disabled>Khóa</Button>
          <IconButton aria-label="Tìm">
            <Search size={18} />
          </IconButton>
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Ô nhập</h2>
        <Input label="Email" name="email" placeholder="ban@email.com" />
        <Input label="Ô khóa" name="locked" disabled placeholder="Không sửa được" />
        <Select label="Thể loại" name="genre" defaultValue="hai">
          <option value="hai">Hài</option>
          <option value="hanh-dong">Hành động</option>
        </Select>
        <Checkbox label="Đã xem" />
        <Switch label="Bật Danmaku" checked={on} onCheckedChange={setOn} />
        <Slider label="Độ mờ" min={20} max={100} defaultValue={80} />
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Thanh và nhãn</h2>
        <Tabs
          tabs={[
            { id: "all", label: "Tất cả" },
            { id: "published", label: "Công khai" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="flex flex-wrap gap-2">
          <Chip>Hài</Chip>
          <Badge>Nháp</Badge>
          <Badge tone="ok">Công khai</Badge>
          <Badge tone="danger">Thiếu video</Badge>
        </div>
        <div className="flex gap-2">
          {(["P", "K", "T13", "T16", "T18"] as const).map((rating) => (
            <AgeBadge key={rating} rating={rating} />
          ))}
        </div>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Hộp thoại</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialog(true)}>
            Mở hộp thoại
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(true)}>
            Mở xác nhận
          </Button>
          <Button variant="secondary" onClick={() => setDrawer(true)}>
            Mở ngăn kéo
          </Button>
          <Button variant="secondary" onClick={() => toast("Đã lưu")}>
            Hiện thông báo
          </Button>
        </div>
        <Dialog open={dialog} title="Hộp thoại" onClose={() => setDialog(false)}>
          <p className="text-sm text-muted">Nội dung nằm trong hộp thoại.</p>
        </Dialog>
        <ConfirmDialog
          open={confirm}
          title="Xóa phim?"
          message="Phim sẽ bị xóa khỏi danh sách."
          confirmLabel="Xóa"
          onConfirm={() => setConfirm(false)}
          onClose={() => setConfirm(false)}
        />
        <Drawer open={drawer} title="Ngăn kéo" onClose={() => setDrawer(false)}>
          <p className="text-sm">Nội dung ngăn kéo.</p>
        </Drawer>
      </section>
      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Trạng thái</h2>
        <Spinner />
        <Skeleton className="h-10 w-full" />
        <Pagination page={page} pageCount={4} onPage={setPage} />
        <EmptyState title="Không tìm thấy phim" />
        <ErrorState title="Có lỗi xảy ra, vui lòng thử lại" onRetry={() => undefined} />
      </section>
      <section className="grid gap-6">
        <h2 className="text-xl font-extrabold">Thẻ phim</h2>
        <MovieRail title="Hàng phim" movies={SAMPLE} />
        <MovieGrid movies={SAMPLE} />
      </section>
    </div>
  );
}
