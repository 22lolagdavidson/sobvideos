"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; match?: string[] }[] }) {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="Main">
      {links.map((l) => {
        const on = [l.href, ...(l.match ?? [])].some((h) => path === h || (h !== "/" && path.startsWith(h + "/")));
        return (
          <Link key={l.href} href={l.href} aria-current={on ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
