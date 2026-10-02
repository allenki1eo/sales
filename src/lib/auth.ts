import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { SESSION_MAX_AGE_SECONDS, sessionTokenCookie } from "@/lib/session-token";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      // Password sign-in only. IMS SSO never reaches this function; it verifies
      // its own JWT and then issues the same NextAuth session cookie.
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
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  secret: process.env.NEXTAUTH_SECRET,
  // Allow HTTP on local/internal network deployments (no HTTPS).
  // When this override is absent, NextAuth uses its secure-cookie defaults.
  // /api/sso/callback must set the same cookie name (see sessionTokenCookie).
  cookies: process.env.NEXTAUTH_URL?.startsWith("https://")
    ? undefined
    : {
        sessionToken: {
          name: sessionTokenCookie().name,
          options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
        },
      },
};
