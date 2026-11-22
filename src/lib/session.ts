import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";

const COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return new TextEncoder().encode(s ?? "dev-only-secret-change-me-dev-only-secret");
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    if (!user) return null;
    // A password change signs out every login made before it.
    if (user.passwordChangedAt && (payload.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

/**
 * The signed-in user, or a redirect to login. Someone with a temporary password
 * is sent to the account page to choose a new one before using the app.
 */
export async function requireUser(opts?: { allowTemporaryPassword?: boolean }): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts?.allowTemporaryPassword) redirect("/account");
  return user;
}

/**
 * Returns the client if the viewer may see their data: the client themself,
 * or the client's coach. Otherwise null.
 */
export async function getViewableClient(viewer: User, clientId: string): Promise<User | null> {
  if (viewer.role === "client") return viewer.id === clientId ? viewer : null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) return null;
  const db = await getDb();
  const [client] = await db.select().from(users).where(eq(users.id, clientId));
  if (!client || client.role !== "client" || client.coachId !== viewer.id) return null;
  return client;
}
