import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/forms";
import { AuthLayout } from "@/components/auth-layout";
import { getCurrentUser } from "@/lib/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthLayout title="Create your account" footer={<>Already have an account? <Link href="/login" className="font-medium text-accent">Log in</Link></>}>
      <SignupForm />
    </AuthLayout>
  );
}
