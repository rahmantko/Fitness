import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms";
import { AuthLayout } from "@/components/auth-layout";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthLayout title="Welcome back" footer={<>New here? <Link href="/signup" className="font-medium text-accent">Create an account</Link></>}>
      <LoginForm />
    </AuthLayout>
  );
}
