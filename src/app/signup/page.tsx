import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignupForm } from "@/components/forms";
import { AuthLayout } from "@/components/auth-layout";
import { getCurrentUser } from "@/lib/session";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const raw = (await searchParams).code?.trim().toUpperCase().slice(0, 20);
  let coachName: string | null = null;
  if (raw) {
    const db = await getDb();
    const [coach] = await db.select({ name: users.name, role: users.role }).from(users).where(eq(users.inviteCode, raw));
    if (coach?.role === "coach") coachName = coach.name;
  }
  return (
    <AuthLayout
      title={coachName ? `Join ${coachName} on Checkpoint` : "Create your account"}
      footer={<>Already have an account? <Link href="/login" className="font-medium text-accent">Log in</Link></>}
    >
      {raw && !coachName && (
        <p className="mb-4 rounded-lg bg-surface-2 p-3 text-sm">That invite link is out of date. Ask your coach for a new one, or enter their current code below.</p>
      )}
      <SignupForm code={coachName ? raw : undefined} />
    </AuthLayout>
  );
}
