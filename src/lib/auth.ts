import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const allowedEmail = process.env.ALLOWED_GOOGLE_EMAIL;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email;
      // Only the single allowed Google account may use the application.
      return Boolean(email && allowedEmail && email === allowedEmail);
    },
    async session({ session, user }) {
      const email = user?.email;
      // Defense-in-depth: keep only authorized identities in the session.
      if (email && allowedEmail && email !== allowedEmail) {
        return { ...session, user: undefined, expires: session.expires };
      }
      return session;
    },
  },
});