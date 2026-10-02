import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";
import {
  SESSION_MAX_AGE_SECONDS,
  sessionTokenCookie,
} from "@/lib/auth";
import type { LocalSalesUser } from "@/lib/sso-user";

/** Same chunk size NextAuth uses so a large session cookie still round-trips. */
const CHUNK_SIZE = 4096 - 163;

/**
 * Encrypt a NextAuth JWT session for this user.
 * Claims mirror the credentials `jwt` callback: local id, role, and username-as-email.
 * The IMS handoff token is not copied into the session.
 */
export async function encodeSalesSession(user: LocalSalesUser): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is not set");
  }

  return encode({
    secret,
    maxAge: SESSION_MAX_AGE_SECONDS,
    token: {
      name: user.fullName,
      email: user.username,
      sub: user.id,
      id: user.id,
      role: user.role,
      signature_path: user.signaturePath ?? undefined,
    },
  });
}

export function applySessionCookie(response: NextResponse, sessionToken: string): void {
  const cookie = sessionTokenCookie();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const options = { ...cookie.options, expires };

  // Clear stale chunks. getToken concatenates every cookie whose name starts
  // with the session cookie name.
  for (let i = 0; i < 4; i++) {
    response.cookies.set(`${cookie.name}.${i}`, "", { ...cookie.options, maxAge: 0 });
  }

  if (sessionToken.length <= CHUNK_SIZE) {
    response.cookies.set(cookie.name, sessionToken, options);
    return;
  }

  const count = Math.ceil(sessionToken.length / CHUNK_SIZE);
  for (let i = 0; i < count; i++) {
    response.cookies.set(
      `${cookie.name}.${i}`,
      sessionToken.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      options
    );
  }
}

/** Post-login URL on this app only. Never echoes the handoff token. */
export function postLoginUrl(request: Request): URL {
  const configured = process.env.NEXTAUTH_URL?.trim();
  if (configured) {
    try {
      const base = new URL(configured);
      if (base.protocol === "http:" || base.protocol === "https:") {
        return new URL("/dashboard", base);
      }
    } catch {
      // Fall through to the request origin.
    }
  }
  return new URL("/dashboard", new URL(request.url).origin);
}
