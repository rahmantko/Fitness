import Link from "next/link";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { TopBar } from "@/components/shell";
import { Card } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { ChangePasswordForm } from "@/components/password-forms";
import { AvatarUpload, ProfileForm } from "@/components/profile-forms";
import { logout } from "@/app/actions";
import { requireUser } from "@/lib/session";

function age(dob: string) {
  const d = new Date(dob + "T00:00:00Z");
  const now = new Date();
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() || (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

export default async function AccountPage() {
  const user = await requireUser({ allowTemporaryPassword: true });
  const db = await getDb();
  const [coach] = user.coachId
    ? await db.select({ name: users.name, avatarKey: users.avatarKey }).from(users).where(eq(users.id, user.coachId))
    : [];
  const [clients] =
    user.role === "coach"
      ? await db.select({ n: count() }).from(users).where(and(eq(users.coachId, user.id), eq(users.role, "client")))
      : [];
  const since = user.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const back = user.role === "client" ? `/clients/${user.id}` : "/";

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {!user.mustChangePassword && (
          <Link href={back} className="text-sm text-muted hover:text-text">
            ← Back
          </Link>
        )}
        {user.mustChangePassword && (
          <p className="rounded-xl bg-accent-soft p-4 text-sm">
            You&apos;re using a temporary password. Choose a new one below to continue.
          </p>
        )}

        <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-5 text-center sm:flex-row sm:text-left">
          <Avatar name={user.name} avatarKey={user.avatarKey} size="lg" />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-2xl font-semibold">{user.name}</h1>
            <p className="text-sm text-muted">
              <span className="capitalize">{user.role}</span> · Member since {since}
            </p>
            <p className="text-sm text-muted">
              {coach && <>Coached by {coach.name}</>}
              {clients && <>{clients.n === 1 ? "1 client" : `${clients.n} clients`}</>}
              {user.dateOfBirth && <> · {age(user.dateOfBirth)} years old</>}
              {user.heightCm != null && <> · {user.heightCm} cm</>}
            </p>
            {user.bio && <p className="whitespace-pre-line pt-1 text-sm">{user.bio}</p>}
            {!user.mustChangePassword && (
              <div className="flex justify-center pt-2 sm:justify-start">
                <AvatarUpload hasAvatar={!!user.avatarKey} />
              </div>
            )}
          </div>
        </section>

        {!user.mustChangePassword && (
          <Card title="Your details">
            <ProfileForm
              user={{
                name: user.name,
                email: user.email,
                phone: user.phone,
                dateOfBirth: user.dateOfBirth,
                heightCm: user.heightCm,
                bio: user.bio,
                role: user.role,
              }}
            />
          </Card>
        )}

        <Card title="Change password">
          <ChangePasswordForm temporary={user.mustChangePassword} />
        </Card>

        <form action={logout}>
          <button className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-danger hover:bg-surface-2">
            Log out
          </button>
        </form>
      </main>
    </>
  );
}
