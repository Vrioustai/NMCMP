"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  birthYearError,
  confirmPasswordError,
  displayNameError,
  emailError,
  passwordError,
} from "../../lib/account-rules";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import { errorMessage } from "../../lib/error-messages";
import { errorsByField } from "../../lib/field-errors";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function RegisterForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const displayName = String(data.get("displayName") ?? "");
    const email = String(data.get("email") ?? "");
    const birthYear = String(data.get("birthYear") ?? "");
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirmPassword") ?? "");
    const local: Record<string, string> = {};
    const nameMessage = displayNameError(displayName);
    const emailMessage = emailError(email);
    const yearMessage = birthYearError(birthYear);
    const passwordMessage = passwordError(password);
    const confirmMessage = confirmPasswordError(password, confirm);
    if (nameMessage) local.displayName = nameMessage;
    if (emailMessage) local.email = emailMessage;
    if (yearMessage) local.birthYear = yearMessage;
    if (passwordMessage) local.password = passwordMessage;
    if (confirmMessage) local.confirmPassword = confirmMessage;
    setFields(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;

    setPending(true);
    try {
      await apiClient("/auth/register", {
        method: "POST",
        body: {
          email: email.trim().toLowerCase(),
          password,
          displayName: displayName.trim(),
          birthYear: Number(birthYear),
        },
      });
      router.push("/");
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
      <Input
        label="Tên hiển thị"
        name="displayName"
        autoComplete="nickname"
        error={fields.displayName}
      />
      <Input label="Email" name="email" type="email" autoComplete="email" error={fields.email} />
      <Input
        label="Năm sinh"
        name="birthYear"
        inputMode="numeric"
        autoComplete="bday-year"
        maxLength={4}
        error={fields.birthYear}
      />
      <Input
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete="new-password"
        error={fields.password}
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
        Đăng ký
      </Button>
    </form>
  );
}
