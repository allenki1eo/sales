import { NextResponse } from "next/server";
import {
  SsoConfigError,
  SsoTokenError,
  ssoSharedSecret,
  verifySsoHandoffToken,
} from "@/lib/sso";
import { redeemSsoJti } from "@/lib/sso-jti";
import { findLocalUserForSso } from "@/lib/sso-user";
import { applySessionCookie, encodeSalesSession, postLoginUrl } from "@/lib/sso-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Public route. The IMS handoff token is the credential.
 * This app has no Next.js middleware; other API routes check getServerSession
 * themselves. Do not put this path behind an auth gate — the browser arrives
 * here without a Sales session cookie.
 */

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  Pragma: "no-cache",
};

function ssoError(status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS });
}

function logReject(reason: string) {
  // Reason codes only. Never log the request URL or the raw token.
  console.error("SSO callback rejected", { reason });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return ssoError(401, "Missing SSO token. Open Sales from IMS again.");
  }

  let secret: string;
  try {
    secret = ssoSharedSecret();
  } catch (err) {
    logReject(err instanceof SsoConfigError ? err.reason : "config");
    return ssoError(500, "SSO is not configured");
  }

  if (!process.env.NEXTAUTH_SECRET?.trim()) {
    logReject("missing_nextauth_secret");
    return ssoError(500, "SSO is not configured");
  }

  let identity;
  try {
    identity = await verifySsoHandoffToken(token, secret);
  } catch (err) {
    logReject(err instanceof SsoTokenError ? err.reason : "invalid");
    return ssoError(401, "Invalid or expired SSO token. Open Sales from IMS again.");
  }

  let redeemed: boolean;
  try {
    redeemed = await redeemSsoJti(identity.jti, identity.exp);
  } catch {
    logReject("jti_store");
    return ssoError(500, "SSO sign-in failed");
  }
  if (!redeemed) {
    logReject("replay");
    return ssoError(401, "This SSO link has already been used. Open Sales from IMS again.");
  }

  let user;
  try {
    user = await findLocalUserForSso(identity);
  } catch {
    logReject("user_lookup");
    return ssoError(500, "SSO sign-in failed");
  }
  if (!user) {
    logReject("no_local_user");
    return ssoError(
      403,
      "No Sales user matches this IMS account. An admin must create a Sales user whose username matches the IMS email or username."
    );
  }

  try {
    const sessionToken = await encodeSalesSession(user);
    const response = NextResponse.redirect(postLoginUrl(request), 302);
    for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
      response.headers.set(key, value);
    }
    applySessionCookie(response, sessionToken);
    console.info("SSO callback accepted", { userId: user.id });
    return response;
  } catch {
    logReject("session");
    return ssoError(500, "SSO sign-in failed");
  }
}
