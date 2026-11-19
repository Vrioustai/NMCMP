import Link from "next/link";

export function AuthTabs({ current }: { current: "login" | "register" }) {
  return (
    <div className="mt-6 flex items-center gap-3 text-sm">
      <Link
        href="/login"
        className={current === "login" ? "font-semibold text-accent" : "text-muted"}
        aria-current={current === "login" ? "page" : undefined}
      >
        Đăng nhập
      </Link>
      <span className="text-dim" aria-hidden>
        ·
      </span>
      <Link
        href="/register"
        className={current === "register" ? "font-semibold text-accent" : "text-muted"}
        aria-current={current === "register" ? "page" : undefined}
      >
        Đăng ký
      </Link>
    </div>
  );
}
