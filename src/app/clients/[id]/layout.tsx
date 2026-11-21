import { notFound } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/shell";
import { Tabs } from "@/components/tabs";
import { getViewableClient, requireUser } from "@/lib/session";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const client = await getViewableClient(user, id);
  if (!client) notFound();
  const base = `/clients/${id}`;
  return (
    <>
      <TopBar user={user} />
      <div className="mx-auto max-w-5xl px-4 pt-5">
        {user.role === "coach" && (
          <Link href="/" className="text-sm text-muted hover:text-text">
            ← All clients
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-semibold">{user.role === "coach" ? client.name : `Hi, ${client.name.split(" ")[0]}`}</h1>
        <Tabs
          items={[
            { href: base, label: "Overview" },
            { href: `${base}/nutrition`, label: "Nutrition" },
            { href: `${base}/cardio`, label: "Cardio & steps" },
            { href: `${base}/training`, label: "Training" },
            { href: `${base}/checkins`, label: "Check-ins" },
            { href: `${base}/compare`, label: "Compare" },
            { href: `${base}/bloodwork`, label: "Blood work" },
            { href: `${base}/plan`, label: "Plan" },
            { href: `${base}/daily`, label: "History" },
          ]}
        />
      </div>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">{children}</main>
    </>
  );
}
