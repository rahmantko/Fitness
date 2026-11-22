"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { saveFile } from "@/lib/storage";
import { isIsoDate, num, str } from "@/lib/format";
import type { FormState } from "./actions";

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = str(form.get("name"))?.slice(0, 80);
  const email = str(form.get("email"))?.toLowerCase().slice(0, 200);
  if (!name) return { error: "Enter your name." };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };

  const dob = str(form.get("dateOfBirth"));
  if (dob && (!isIsoDate(dob) || dob > new Date().toISOString().slice(0, 10) || dob < "1900-01-01")) {
    return { error: "Enter a valid date of birth." };
  }
  const height = num(form.get("heightCm"));
  if (height != null && (height < 50 || height > 260)) return { error: "Height should be in centimetres (e.g. 175)." };

  const db = await getDb();
  if (email !== user.email) {
    // Changing the login email needs the password, so someone with an unlocked phone can't take the account.
    const current = String(form.get("current") ?? "");
    if (!current) return { error: "Enter your current password to change your email." };
    if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Your current password is incorrect." };
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)));
    if (taken) return { error: "Another account already uses that email." };
  }

  await db
    .update(users)
    .set({
      name,
      email,
      phone: str(form.get("phone"))?.slice(0, 40) ?? null,
      dateOfBirth: dob,
      heightCm: height,
      bio: str(form.get("bio"))?.slice(0, 500) ?? null,
    })
    .where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

export async function uploadAvatar(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { error: "Use a JPEG or PNG photo." };
  if (file.size > 5 * 1024 * 1024) return { error: "That photo is too large." };
  let key: string;
  try {
    key = await saveFile(user.id, file);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const db = await getDb();
  await db.update(users).set({ avatarKey: key }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: "Profile picture updated." };
}

export async function removeAvatar() {
  const user = await requireUser();
  const db = await getDb();
  await db.update(users).set({ avatarKey: null }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}
