"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { emailError } from "../../lib/account-rules";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import { errorMessage } from "../../lib/error-messages";
import { errorsByField } from "../../lib/field-errors";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ForgotForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const emailMessage = emailError(email);
    setFields(emailMessage ? { email: emailMessage } : {});
    setFormError(null);
    if (emailMessage) return;

    setPending(true);
    try {
      await apiClient("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setFields(errorsByField(error.details));
      } else {
        setFormError(error instanceof ApiError ? error.message : errorMessage(undefined));
      }
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-6 grid gap-3">
        <p role="status">Đã gửi link. Hãy kiểm tra email.</p>
        <Link href="/login" className="text-sm text-accent">
          Về đăng nhập
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-3" noValidate>
      <Input label="Email" name="email" type="email" autoComplete="email" error={fields.email} />
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        Gửi liên kết
      </Button>
      <Link href="/login" className="text-sm text-muted">
        Về đăng nhập
      </Link>
    </form>
  );
}
