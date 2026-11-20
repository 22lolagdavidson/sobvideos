"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SubNav({ links }: { links: { href: string; label: string; exact?: boolean }[] }) {
  const path = usePathname();
  return (
    <nav className="subnav" aria-label="Group sections">
      {links.map((l) => {
        const on = l.exact ? path === l.href : path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
