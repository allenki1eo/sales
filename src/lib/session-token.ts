import { encode } from "next-auth/jwt";

/** Matches authOptions.session.maxAge (8 hours). */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/**
 * NextAuth's secure-cookie decision, mirrored so the SSO callback sets the
 * cookie getServerSession will read.
 *
 * - NEXTAUTH_URL is not https: auth.ts forces `next-auth.session-token`.
 * - Otherwise, on Vercel / AUTH_TRUST_HOST, the request's x-forwarded-proto
 *   wins (anything other than "http" is treated as https, including a missing
 *   proto — same as next-auth detectOrigin).
 * - Otherwise NEXTAUTH_URL itself is https.
 */
export function usesSecureAuthCookies(forwardedProto?: string | null): boolean {
  if (!process.env.NEXTAUTH_URL?.startsWith("https://")) return false;
  if (process.env.VERCEL || process.env.AUTH_TRUST_HOST) {
    return forwardedProto !== "http";
  }
  return true;
}

export function sessionTokenCookie(forwardedProto?: string | null): {
  name: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    path: string;
    secure: boolean;
    maxAge: number;
  };
} {
  const secure = usesSecureAuthCookies(forwardedProto);
  return {
    name: `${secure ? "__Secure-" : ""}next-auth.session-token`,
    options: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  };
}

// NextAuth chunks session cookies above this size (4096 - estimated overhead).
const SESSION_COOKIE_CHUNK = 3933;

export function sessionCookieParts(
  jwt: string,
  forwardedProto?: string | null
): { name: string; value: string; options: ReturnType<typeof sessionTokenCookie>["options"] }[] {
  const cookie = sessionTokenCookie(forwardedProto);
  if (jwt.length <= SESSION_COOKIE_CHUNK) {
    return [{ name: cookie.name, value: jwt, options: cookie.options }];
  }
  const parts = [];
  const count = Math.ceil(jwt.length / SESSION_COOKIE_CHUNK);
  for (let i = 0; i < count; i++) {
    parts.push({
      name: `${cookie.name}.${i}`,
      value: jwt.slice(i * SESSION_COOKIE_CHUNK, (i + 1) * SESSION_COOKIE_CHUNK),
      options: cookie.options,
    });
  }
  return parts;
}

export type SessionUserClaims = {
  id: string;
  name: string;
  /** Sales stores the login name in the NextAuth email claim (see authorize). */
  email: string;
  role: string;
  signature_path?: string;
};

/**
 * Encrypt a NextAuth JWT session with the same claims the credentials
 * jwt() callback writes after a password login.
 */
export async function encodeSessionToken(user: SessionUserClaims, secret: string): Promise<string> {
  return encode({
    token: {
      name: user.name,
      email: user.email,
      sub: user.id,
      id: user.id,
      role: user.role,
      ...(user.signature_path ? { signature_path: user.signature_path } : {}),
    },
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}
