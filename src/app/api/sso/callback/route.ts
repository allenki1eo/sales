import { NextRequest, NextResponse } from "next/server";
import { consumeSsoJti, findOrCreateSsoUser, verifySsoToken } from "@/lib/sso";
import { encodeSessionToken, sessionCookieParts } from "@/lib/session-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * IMS launch sign-in.
 *
 * IMS redirects an already-authenticated user to
 *   GET /api/sso/callback?token=<HS256 JWT>
 * signed with SSO_SHARED_SECRET (audience "sales", lifetime ≤ 120s).
 * A valid token becomes a normal NextAuth session and the browser is sent
 * to /dashboard. Password login is unchanged.
 *
 * The token is a credential: do not log the query string.
 */

type ErrorCode = "missing" | "not_configured" | "invalid" | "replayed" | "unprovisioned" | "error";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ssoErrorResponse(code: ErrorCode, username?: string): NextResponse {
  const copy: Record<ErrorCode, { status: number; title: string; body: string }> = {
    missing: {
      status: 400,
      title: "Sign-in link incomplete",
      body: "This launch link did not include a sign-in token. Open Sales from IMS again.",
    },
    not_configured: {
      status: 503,
      title: "Single sign-on is unavailable",
      body: "Single sign-on is not configured on this server. Ask an administrator.",
    },
    invalid: {
      status: 401,
      title: "Sign-in link rejected",
      body: "This sign-in link is invalid or has expired. Open Sales from IMS again.",
    },
    replayed: {
      status: 401,
      title: "Sign-in link already used",
      body: "This sign-in link was already used. Open Sales from IMS again.",
    },
    unprovisioned: {
      status: 403,
      title: "No Sales account",
      body: username
        ? `No Sales user matches ${username}. Ask an administrator to create a user with that username, then open Sales from IMS again.`
        : "No Sales user matches this IMS account. Ask an administrator to create one, then open Sales from IMS again.",
    },
    error: {
      status: 500,
      title: "Sign-in failed",
      body: "Sign-in could not be completed. Open Sales from IMS again.",
    },
  };

  const { status, title, body } = copy[code];
  const safeBody = escapeHtml(body);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      font-family: ui-sans-serif, system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    main { max-width: 28rem; padding: 2rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.75rem; }
    p { line-height: 1.5; color: #cbd5e1; }
    a { color: #a5b4fc; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${safeBody}</p>
    <p><a href="/login">Sign in with a password</a></p>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!token) return ssoErrorResponse("missing");

  const ssoSecret = process.env.SSO_SHARED_SECRET;
  const authSecret = process.env.NEXTAUTH_SECRET;
  if (!ssoSecret || !authSecret) return ssoErrorResponse("not_configured");

  const verified = verifySsoToken(token, ssoSecret);
  if (!verified.ok) {
    console.warn(`[SSO] rejected:${verified.reason}`);
    return ssoErrorResponse("invalid");
  }

  try {
    const fresh = await consumeSsoJti(verified.identity.jti, verified.identity.exp);
    if (!fresh) {
      console.warn("[SSO] rejected:replayed");
      return ssoErrorResponse("replayed");
    }

    const resolved = await findOrCreateSsoUser(verified.identity);
    if (!resolved.ok) return ssoErrorResponse("unprovisioned", resolved.username);

    const jwt = await encodeSessionToken(
      {
        id: resolved.user.id,
        name: resolved.user.full_name,
        email: resolved.user.username,
        role: resolved.user.role,
        signature_path: resolved.user.signature_path,
      },
      authSecret
    );

    // Relative Location keeps the browser on the host that received the
    // session cookie (the host IMS redirected to), including behind a proxy.
    const response = new NextResponse(null, {
      status: 302,
      headers: { Location: "/dashboard" },
    });
    for (const part of sessionCookieParts(jwt, request.headers.get("x-forwarded-proto"))) {
      response.cookies.set(part.name, part.value, part.options);
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    console.error("[SSO] sign-in failed");
    return ssoErrorResponse("error");
  }
}
