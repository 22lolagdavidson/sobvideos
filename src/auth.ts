import NextAuth, { type DefaultSession } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";

declare module "next-auth" {
  interface Session {
    user: { id: string; agencyId: string | null } & DefaultSession["user"];
  }
}

const norm = (e: string) => e.trim().toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/signin", verifyRequest: "/signin/check-email", error: "/signin" },
  providers: [
    Nodemailer({
      server: process.env.EMAIL_SERVER || "smtp://localhost:25", // only our sendMail() sends
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60,
      normalizeIdentifier: norm,
      async sendVerificationRequest({ identifier, url }) {
        await sendMail({
          to: identifier,
          subject: "Your sign-in link for Explainer Studio",
          text: `Sign in to Explainer Studio:\n\n${url}\n\nThis link expires in 15 minutes and works once. If you didn't ask for it, ignore this email.`,
        });
      },
    }),
  ],
  callbacks: {
    /** Invite-only: only emails that already have a User row (created by an admin or the seed) can sign in. */
    async signIn({ user }) {
      if (!user.email) return false;
      return Boolean(await prisma.user.findUnique({ where: { email: norm(user.email) }, select: { id: true } }));
    },
    async session({ session, user }) {
      const u = await prisma.user.findUnique({ where: { id: user.id }, select: { agencyId: true } });
      session.user.id = user.id;
      session.user.agencyId = u?.agencyId ?? null;
      return session;
    },
  },
});
