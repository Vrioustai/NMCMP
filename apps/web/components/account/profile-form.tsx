"use client";

import { AVATAR_URLS } from "@movie/contracts";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { displayNameError } from "../../lib/account-rules";
import { ApiError } from "../../lib/api/errors";
import { apiClient } from "../../lib/api/client";
import type { UserProfile } from "../../lib/api/types";
import { errorMessage } from "../../lib/error-messages";
import { errorsByField } from "../../lib/field-errors";
import { LogoutButton } from "../layout/logout-button";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function ProfileForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(user.displayName);
  const [avatar, setAvatar] = useState(user.avatarUrl);
  const [baseline, setBaseline] = useState({ name: user.displayName, avatar: user.avatarUrl });
  const [formError, setFormError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const unchanged = name.trim() === baseline.name && avatar === baseline.avatar;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || unchanged) return;
    const nameMessage = displayNameError(name);
    setFields(nameMessage ? { displayName: nameMessage } : {});
    setFormError(null);
    setSaved(false);
    if (nameMessage) return;

    const body: { displayName?: string; avatarUrl?: string } = {};
    if (name.trim() !== baseline.name) body.displayName = name.trim();
    if (avatar !== baseline.avatar && avatar) body.avatarUrl = avatar;

    setPending(true);
    try {
      const profile = await apiClient<UserProfile>("/me", { method: "PATCH", body });
      setName(profile.displayName);
      setAvatar(profile.avatarUrl);
      setBaseline({ name: profile.displayName, avatar: profile.avatarUrl });
      setSaved(true);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
        setFields(errorsByField(error.details));
      } else {
        setFormError(error instanceof ApiError ? error.message : errorMessage(undefined));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 grid max-w-xl gap-4" noValidate>
      <dl className="grid gap-3 text-sm">
        <div>
          <dt className="text-muted">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className="text-muted">Năm sinh</dt>
          <dd>{user.birthYear}</dd>
        </div>
      </dl>
      <Input
        label="Tên hiển thị"
        name="displayName"
        value={name}
        autoComplete="nickname"
        error={fields.displayName}
        onChange={(event) => setName(event.target.value)}
      />
      <fieldset className="grid gap-2">
        <legend className="text-sm">Ảnh đại diện</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {AVATAR_URLS.map((url, index) => {
            const selected = avatar === url;
            return (
              <button
                key={url}
                type="button"
                aria-label={`Ảnh đại diện ${index + 1}`}
                aria-pressed={selected}
                className={`overflow-hidden rounded-control border-2 ${selected ? "border-accent" : "border-transparent"}`}
                onClick={() => setAvatar(url)}
              >
                <Image src={url} alt="" width={96} height={96} className="h-auto w-full" />
              </button>
            );
          })}
        </div>
      </fieldset>
      {formError ? (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-ok">
          Đã lưu hồ sơ.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || unchanged} aria-busy={pending}>
          Lưu
        </Button>
        <LogoutButton className="inline-flex h-10 items-center justify-center rounded-control bg-raised px-4 text-sm font-semibold disabled:opacity-50" />
      </div>
    </form>
  );
}
