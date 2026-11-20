import NextAuth, { type DefaultSession } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      agencyId: string | null;
      groupId: string | null;
      employeeId: string | null;
    } & DefaultSession["user"];
  }
}

const norm = (e: string) => e.trim().toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 60 * 60 * 8 }, // 8-hour sessions
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email", error: "/signin" },
  providers: [
    Nodemailer({
      // The SMTP server is only used by our own sendMail(); see sendVerificationRequest.
      server: process.env.EMAIL_SERVER || "smtp://localhost:25",
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60, // magic links expire after 15 minutes
      normalizeIdentifier: norm,
      async sendVerificationRequest({ identifier, url }) {
        const host = new URL(url).host;
        await sendMail({
          to: identifier,
          subject: "Your sign-in link for Open Enrollment Studio",
          text: `Sign in to Open Enrollment Studio:\n\n${url}\n\nThis link expires in 15 minutes and can be used once. If you didn't ask for it, you can ignore this email.\n\n(${host})`,
          html: `<p>Sign in to <b>Open Enrollment Studio</b>:</p><p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2b59c3;color:#fff;border-radius:8px;text-decoration:none">Sign in</a></p><p style="color:#5b6382">This link expires in 15 minutes and can be used once. If you didn't ask for it, you can ignore this email.</p>`,
        });
      },
    }),
  ],
  callbacks: {
    /**
     * Invite-only: an email can sign in only if it already belongs to a User
     * (brokers, employer admins) or to an eligible Employee on a roster.
     */
    async signIn({ user }) {
      const email = user.email ? norm(user.email) : null;
      if (!email) return false;
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) return true;
      const emp = await prisma.employee.findFirst({ where: { email, eligible: true }, select: { id: true } });
      return Boolean(emp);
    },
    async session({ session, user }) {
      const u = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, agencyId: true, groupId: true, employee: { select: { id: true } } },
      });
      session.user.id = user.id;
      session.user.role = u?.role ?? "EMPLOYEE";
      session.user.agencyId = u?.agencyId ?? null;
      session.user.groupId = u?.groupId ?? null;
      session.user.employeeId = u?.employee?.id ?? null;
      return session;
    },
  },
  events: {
    /** First sign-in by a rostered employee: link the new User to their Employee row. */
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      const emp = await prisma.employee.findFirst({
        where: { email: norm(user.email), userId: null, eligible: true },
        include: { group: { select: { agencyId: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (!emp) return;
      await prisma.$transaction([
        prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } }),
        prisma.user.update({
          where: { id: user.id },
          data: { role: "EMPLOYEE", name: emp.name, agencyId: emp.group.agencyId },
        }),
      ]);
    },
  },
});
