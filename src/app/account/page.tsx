import Link from "next/link";
import { TopBar } from "@/components/shell";
import { Card } from "@/components/ui";
import { ChangePasswordForm } from "@/components/password-forms";
import { requireUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await requireUser({ allowTemporaryPassword: true });
  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        {!user.mustChangePassword && (
          <Link href="/" className="text-sm text-muted hover:text-text">
            ← Back
          </Link>
        )}
        <h1 className="text-2xl font-semibold">Your account</h1>
        {user.mustChangePassword && (
          <p className="rounded-xl bg-accent-soft p-4 text-sm">
            You&apos;re using a temporary password. Choose a new one to continue.
          </p>
        )}
        <Card title="Details">
          <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted">Name</dt>
            <dd>{user.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted">Account type</dt>
            <dd className="capitalize">{user.role}</dd>
          </dl>
        </Card>
        <Card title="Change password">
          <ChangePasswordForm temporary={user.mustChangePassword} />
        </Card>
      </main>
    </>
  );
}
