import Link from "next/link";
import { AuthLayout } from "@/components/auth-layout";
import { ForgotPasswordForm } from "@/components/password-forms";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Forgot your password?" footer={<Link href="/login" className="font-medium text-accent">Back to log in</Link>}>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
