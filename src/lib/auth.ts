import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        otp: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const otp = credentials?.otp as string;

        if (!email || !otp) return null;

        const record = await prisma.otpCode.findFirst({
          where: {
            email,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!record) return null;

        const valid = await bcrypt.compare(otp, record.code);
        if (!valid) return null;

        await prisma.otpCode.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
