"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { removeAvatar, updateProfile, uploadAvatar } from "@/app/profile-actions";
import type { FormState } from "@/app/actions";
import { Field, inputCls } from "./ui";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text hover:opacity-90 disabled:opacity-60">
      {pending ? "Saving…" : children}
    </button>
  );
}

function Status({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.error ? "text-danger" : "text-accent"}`}>
      {state.error ?? state.ok}
    </p>
  );
}

/** Shrinks a photo to a 512px square JPEG in the browser (also turns iPhone HEIC photos into JPEG). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(512, side);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read that photo."))), "image/jpeg", 0.88),
  );
}

export function AvatarUpload({ hasAvatar }: { hasAvatar: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<FormState>(undefined);
  const [pending, start] = useTransition();

  function onPick(file: File | undefined) {
    if (!file) return;
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("avatar", new File([await toSquareJpeg(file)], "avatar.jpg", { type: "image/jpeg" }));
        setState(await uploadAvatar(undefined, fd));
      } catch {
        setState({ error: "Couldn't read that photo. Try a different one." });
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {pending ? "Uploading…" : hasAvatar ? "Change photo" : "Add profile photo"}
        </button>
        {hasAvatar && !pending && (
          <button
            type="button"
            onClick={() => start(async () => { await removeAvatar(); setState(undefined); })}
            className="px-2 text-sm text-muted hover:text-text"
          >
            Remove
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Profile photo" onChange={(e) => onPick(e.target.files?.[0])} />
      <Status state={state} />
    </div>
  );
}

export function ProfileForm({
  user,
}: {
  user: { name: string; email: string; phone: string | null; dateOfBirth: string | null; heightCm: number | null; bio: string | null; role: string };
}) {
  const [state, action] = useActionState(updateProfile, undefined);
  const [email, setEmail] = useState(user.email);
  const emailChanged = email.trim().toLowerCase() !== user.email;
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required defaultValue={user.name} autoComplete="name" className={inputCls} />
      </Field>
      <Field label="Email" hint="You log in with this">
        <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={inputCls} />
      </Field>
      {emailChanged && (
        <div className="sm:col-span-2">
          <Field label="Current password" hint="Needed to change your email">
            <input name="current" type="password" required autoComplete="current-password" className={inputCls} />
          </Field>
        </div>
      )}
      <Field label="Phone (optional)">
        <input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" className={inputCls} />
      </Field>
      {user.role === "client" && (
        <>
          <Field label="Date of birth (optional)">
            <input name="dateOfBirth" type="date" defaultValue={user.dateOfBirth ?? ""} className={inputCls} />
          </Field>
          <Field label="Height in cm (optional)">
            <input name="heightCm" type="number" inputMode="decimal" step="0.1" min="50" max="260" defaultValue={user.heightCm ?? ""} className={inputCls} />
          </Field>
        </>
      )}
      <div className="sm:col-span-2">
        <Field label={user.role === "client" ? "About me and my goals (optional)" : "About me (optional)"}>
          <textarea name="bio" rows={3} maxLength={500} defaultValue={user.bio ?? ""} className={inputCls} />
        </Field>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Submit>Save profile</Submit>
        <Status state={state} />
      </div>
    </form>
  );
}
