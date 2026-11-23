import { TopBar } from "@/components/shell";
import { Tabs } from "@/components/tabs";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Admin · Checkpoint" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <TopBar user={user} />
      <div className="mx-auto max-w-5xl px-4 pt-5">
        <div className="text-xs font-medium uppercase tracking-wide text-accent">Admin</div>
        <h1 className="text-2xl font-semibold">Control centre</h1>
        <Tabs
          items={[
            { href: "/admin", label: "Overview" },
            { href: "/admin/users", label: "Users" },
            { href: "/admin/foods", label: "Food library" },
          ]}
        />
      </div>
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5">{children}</main>
    </>
  );
}
