import type { Metadata } from "next";
import { Baloo_2, Inter } from "next/font/google";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const baloo = Baloo_2({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-baloo" });

export const metadata: Metadata = {
  title: "Open Enrollment Studio",
  description: "Open enrollment and plain-language plan explainer videos for small-business health benefits.",
};

function linksFor(role: string | undefined, groupId: string | null | undefined) {
  switch (role) {
    case "BROKER_ADMIN":
      return [{ href: "/broker", label: "Groups", match: ["/groups"] }];
    case "EMPLOYER_ADMIN":
      return groupId ? [{ href: `/groups/${groupId}`, label: "Dashboard" }] : [];
    case "EMPLOYEE":
      return [
        { href: "/enroll", label: "Enroll" },
        { href: "/plans", label: "Plans & Videos" },
      ];
    default:
      return [];
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const user = session?.user;
  const agency = user?.agencyId
    ? await prisma.agency.findUnique({ where: { id: user.agencyId }, select: { name: true } })
    : null;
  const links = linksFor(user?.role, user?.groupId);

  return (
    <html lang="en" className={`${inter.variable} ${baloo.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="hrow">
            <Logo agencyName={agency?.name} />
            <div className="spacer" />
            {user && (
              <>
                <span className="small" style={{ opacity: 0.9 }}>
                  {user.email}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/signin" });
                  }}
                >
                  <button className="btn sm on-dark" type="submit">
                    Sign out
                  </button>
                </form>
              </>
            )}
          </div>
          {links.length > 0 ? <NavLinks links={links} /> : <div style={{ height: 18 }} />}
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  );
}
