"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = [...items].sort((a, b) => b.href.length - a.href.length).find((i) => path.startsWith(i.href));
  return (
    <nav className="-mx-4 mt-4 overflow-x-auto border-b border-border px-4">
      <ul className="flex gap-1 whitespace-nowrap">
        {items.map((i) => {
          const on = active?.href === i.href;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={on ? "page" : undefined}
                className={`inline-block border-b-2 px-3 py-2 text-sm ${
                  on ? "border-accent font-medium text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
