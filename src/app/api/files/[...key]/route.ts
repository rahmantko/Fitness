import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { getCurrentUser, getViewableClient } from "@/lib/session";
import { fileOwner, isValidKey, readStoredFile } from "@/lib/storage";

/** Profile pictures are also visible between a coach and their clients, in both directions. */
async function canSeeAvatar(viewer: User, key: string) {
  const db = await getDb();
  const [owner] = await db.select({ id: users.id, coachId: users.coachId }).from(users).where(eq(users.avatarKey, key));
  if (!owner) return false;
  return owner.id === viewer.id || owner.id === viewer.coachId || owner.coachId === viewer.id;
}

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!isValidKey(key)) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!(await getViewableClient(user, fileOwner(key))) && !(await canSeeAvatar(user, key))) {
    return new Response("Not found", { status: 404 });
  }
  const file = await readStoredFile(key);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
