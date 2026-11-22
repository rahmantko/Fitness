import Link from "next/link";
import { logout } from "@/app/actions";
import type { User } from "@/db/schema";

export function TopBar({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-7 w-7" />
          Checkpoint
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/account" className="text-muted hover:text-text">
            <span className="hidden sm:inline">
              {user.name} · <span className="capitalize">{user.role}</span>
            </span>
            <span className="sm:hidden">Account</span>
          </Link>
          <form action={logout}>
            <button className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-2">Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
