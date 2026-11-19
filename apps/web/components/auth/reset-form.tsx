"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { confirmPasswordError, passwordError } from "../../lib/account-rules";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import { errorMessage } from "../../lib/error-messages";
import { errorsByField } from "../../lib/field-errors";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ResetForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("token");
    // Xóa mã khỏi thanh địa chỉ ngay sau khi đọc, để nó không nằm trong lịch sử.
    url.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    setToken(value);
    setReady(true);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get("newPassword") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    const local: Record<string, string> = {};
    const passwordMessage = passwordError(newPassword);
    const confirmMessage = confirmPasswordError(newPassword, confirm);
    if (passwordMessage) local.newPassword = passwordMessage;
    if (confirmMessage) local.confirmPassword = confirmMessage;
    setFields(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    try {
      await apiClient("/auth/reset-password", {
        method: "POST",
        body: { token, newPassword },
      });
      setDone(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setFields(errorsByField(error.details));
      } else {
        setFormError(error instanceof ApiError ? error.message : errorMessage(undefined));
      }
      setPending(false);
    }
  }

  if (!ready) return null;
  if (!token) {
    return (
      <div className="mt-6 grid gap-3">
        <p role="alert">{errorMessage("RESET_TOKEN_INVALID")}</p>
        <Link href="/forgot-password" className="text-sm text-accent">
          Gửi liên kết mới
        </Link>
      </div>
    );
  }
  if (done) {
    return (
      <div className="mt-6 grid gap-3">
        <p role="status">Đã đặt mật khẩu mới.</p>
        <Link href="/login" className="text-sm text-accent">
          Đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3" noValidate>
      <Input
        label="Mật khẩu mới"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        error={fields.newPassword}
      />
      <Input
        label="Nhập lại mật khẩu"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        error={fields.confirmPassword}
      />
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        Đặt mật khẩu mới
      </Button>
    </form>
  );
}
