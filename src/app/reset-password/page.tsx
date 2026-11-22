import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { NewPasswordForm } from "@/components/password-forms";
import { isResetTokenValid } from "@/app/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await isResetTokenValid(token);
  return (
    <AuthLayout title="Choose a new password" footer={<Link href="/login" className="font-medium text-accent">Back to log in</Link>}>
      {valid ? (
        <NewPasswordForm token={token} />
      ) : (
        <div className="space-y-3 text-sm">
          <p>This reset link has expired or was already used. Links work once, for 1 hour.</p>
          <Link href="/forgot-password" className="font-medium text-accent">Send a new link</Link>
        </div>
      )}
    </AuthLayout>
  );
}
