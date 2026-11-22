"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { checkinComments, checkins } from "@/db/schema";
import { getViewableClient, requireUser } from "@/lib/session";
import { saveFile } from "@/lib/storage";
import { str } from "@/lib/format";
import type { FormState } from "./actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The check-in, if the signed-in user is its client or that client's coach. */
async function viewableCheckin(checkinId: unknown) {
  const user = await requireUser();
  if (typeof checkinId !== "string" || !UUID.test(checkinId)) return null;
  const db = await getDb();
  const [c] = await db.select().from(checkins).where(eq(checkins.id, checkinId));
  if (!c || !(await getViewableClient(user, c.clientId))) return null;
  return { user, c, db };
}

/** Accepts http(s) links only, so a link can't run script when clicked. */
function cleanUrl(raw: string | null): string | null | false {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 500) : false;
  } catch {
    return false;
  }
}

export async function saveFeedback(_: FormState, form: FormData): Promise<FormState> {
  const found = await viewableCheckin(form.get("checkinId"));
  if (!found || found.user.role !== "coach") return { error: "Check-in not found." };
  const { c, db } = found;
  const video = cleanUrl(str(form.get("videoUrl")));
  if (video === false) return { error: "The video link should start with https:// (copy it from Loom's Share button)." };

  let audioKey = form.get("removeAudio") === "1" ? null : c.feedbackAudioKey;
  const audio = form.get("audio");
  if (audio instanceof File && audio.size > 0) {
    if (!audio.type.startsWith("audio/")) return { error: "That file isn't an audio recording." };
    try {
      audioKey = await saveFile(c.clientId, audio);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }
  const text = str(form.get("feedback"));
  const hasAny = !!(text || video || audioKey);
  await db
    .update(checkins)
    .set({
      coachFeedback: text,
      feedbackVideoUrl: video,
      feedbackAudioKey: audioKey,
      feedbackAt: hasAny ? new Date() : null,
    })
    .where(eq(checkins.id, c.id));
  revalidatePath(`/clients/${c.clientId}`, "layout");
  return { ok: "Feedback saved." };
}

export async function addComment(checkinId: string, body: string): Promise<{ error?: string }> {
  const found = await viewableCheckin(checkinId);
  if (!found) return { error: "Check-in not found." };
  const text = body.trim().slice(0, 2000);
  if (!text) return { error: "Write a message first." };
  await found.db.insert(checkinComments).values({ checkinId: found.c.id, authorId: found.user.id, body: text });
  revalidatePath(`/clients/${found.c.clientId}`, "layout");
  return {};
}

export async function deleteComment(commentId: string) {
  const user = await requireUser();
  if (!UUID.test(commentId)) return;
  const db = await getDb();
  const [row] = await db
    .delete(checkinComments)
    .where(and(eq(checkinComments.id, commentId), eq(checkinComments.authorId, user.id)))
    .returning({ checkinId: checkinComments.checkinId });
  if (!row) return;
  const [c] = await db.select({ clientId: checkins.clientId }).from(checkins).where(eq(checkins.id, row.checkinId));
  if (c) revalidatePath(`/clients/${c.clientId}`, "layout");
}
