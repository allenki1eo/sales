import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const result = await db.execute({
          sql: "SELECT * FROM users WHERE username = ?",
          args: [credentials.username],
        });

        const user = result.rows[0];
        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.password as string
        );
        if (!passwordMatch) return null;

        return {
          id: String(user.id),
          name: user.full_name as string,
          email: user.username as string,
          role: user.role as string,
          signature_path: user.signature_path as string | undefined,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.signature_path = (user as { signature_path?: string }).signature_path;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.signature_path = token.signature_path as string;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  // Allow HTTP on local/internal network deployments (no HTTPS)
  cookies: process.env.NEXTAUTH_URL?.startsWith("https://") ? undefined : {
    sessionToken: {
      name: "next-auth.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    },
  },
};
