import Link from "next/link";
import { logout } from "@/app/actions";
import type { User } from "@/db/schema";
import { Avatar } from "./avatar";
import { isAdmin } from "@/lib/admin";

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
          {isAdmin(user) && (
            <Link href="/admin" className="rounded-lg bg-accent-soft px-3 py-1.5 font-medium text-accent hover:opacity-90">
              Admin
            </Link>
          )}
          <Link href="/account" aria-label="Your profile" className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-0.5 text-muted hover:bg-surface-2 hover:text-text sm:pr-3">
            <Avatar name={user.name} avatarKey={user.avatarKey} />
            <span className="hidden sm:inline">
              {user.name} · <span className="capitalize">{user.role}</span>
            </span>
          </Link>
          <form action={logout}>
            <button className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-2">Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
