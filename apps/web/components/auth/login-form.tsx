"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import { emailError, loginPasswordError } from "../../lib/account-rules";
import { errorMessage } from "../../lib/error-messages";
import { errorsByField } from "../../lib/field-errors";
import { safeNext } from "../../lib/safe-next";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const local: Record<string, string> = {};
    const emailMessage = emailError(email);
    const passwordMessage = loginPasswordError(password);
    if (emailMessage) local.email = emailMessage;
    if (passwordMessage) local.password = passwordMessage;
    setFields(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    try {
      await apiClient("/auth/login", {
        method: "POST",
        body: { email: email.trim().toLowerCase(), password },
      });
      router.push(safeNext(next, window.location.origin));
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

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="email" error={fields.email} />
      <Input
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete="current-password"
        error={fields.password}
      />
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm text-accent">
          Quên mật khẩu?
        </Link>
      </div>
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        Đăng nhập
      </Button>
    </form>
  );
}
