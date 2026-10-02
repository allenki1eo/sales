import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { generateKeyPair, SignJWT } from "jose";
import { decode } from "next-auth/jwt";
import {
  SSO_AUDIENCE,
  SSO_CLOCK_SKEW_SECONDS,
  SsoTokenError,
  verifySsoHandoffToken,
} from "./sso";

const SECRET = "s".repeat(48);
const OTHER_SECRET = "o".repeat(48);
const SESSION_SECRET = "n".repeat(48);

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function signHandoff(
  secret: string,
  overrides: {
    email?: string;
    username?: string;
    name?: string;
    sub?: string;
    aud?: string;
    jti?: string;
    iat?: number;
    exp?: number;
    alg?: string;
    extra?: Record<string, unknown>;
  } = {}
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    email: overrides.email ?? "richard@example.com",
    username: overrides.username ?? "richard",
    name: overrides.name ?? "Richard Mugisha",
    ...overrides.extra,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: overrides.alg ?? "HS256", typ: "JWT" })
    .setSubject(overrides.sub ?? "ims-user-1")
    .setAudience(overrides.aud ?? SSO_AUDIENCE)
    .setJti(overrides.jti ?? "jti-valid-12345678")
    .setIssuedAt(overrides.iat ?? now)
    .setExpirationTime(overrides.exp ?? now + 90)
    .sign(new TextEncoder().encode(secret));
}

test("accepts an HS256 sales handoff and ignores a password claim", async () => {
  const token = await signHandoff(SECRET, { extra: { password: "not-a-real-secret" } });
  const identity = await verifySsoHandoffToken(token, SECRET);
  assert.equal(identity.sub, "ims-user-1");
  assert.equal(identity.email, "richard@example.com");
  assert.equal(identity.username, "richard");
  assert.equal(identity.jti, "jti-valid-12345678");
  assert.equal("password" in identity, false);
});

test("rejects alg none", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({
    sub: "ims-user-1",
    aud: "sales",
    email: "richard@example.com",
    username: "richard",
    jti: "jti-none-123456789",
    iat: now,
    exp: now + 90,
  })}.`;
  await assert.rejects(() => verifySsoHandoffToken(token, SECRET), (err: unknown) => {
    assert.ok(err instanceof SsoTokenError);
    assert.equal(err.reason, "alg");
    return true;
  });
});

test("rejects RS256 even if the payload is well formed", async () => {
  const { privateKey } = await generateKeyPair("RS256");
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    email: "richard@example.com",
    username: "richard",
    name: "Richard",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject("ims-user-1")
    .setAudience("sales")
    .setJti("jti-rs256-12345678")
    .setIssuedAt(now)
    .setExpirationTime(now + 90)
    .sign(privateKey);

  await assert.rejects(() => verifySsoHandoffToken(token, SECRET), (err: unknown) => {
    assert.ok(err instanceof SsoTokenError);
    assert.equal(err.reason, "alg");
    return true;
  });
});

test("rejects the wrong audience, a bad signature, and expiry outside clock skew", async () => {
  const now = Math.floor(Date.now() / 1000);
  const hr = await signHandoff(SECRET, { aud: "hr", jti: "jti-hr-1234567890" });
  await assert.rejects(() => verifySsoHandoffToken(hr, SECRET), (err: unknown) => {
    assert.ok(err instanceof SsoTokenError);
    assert.equal(err.reason, "invalid");
    return true;
  });

  const wrongKey = await signHandoff(OTHER_SECRET, { jti: "jti-wrong-key-1234" });
  await assert.rejects(() => verifySsoHandoffToken(wrongKey, SECRET), SsoTokenError);

  const withinSkew = await signHandoff(SECRET, {
    jti: "jti-skew-ok-123456",
    iat: now - 80,
    exp: now - 5,
  });
  const accepted = await verifySsoHandoffToken(withinSkew, SECRET);
  assert.equal(accepted.jti, "jti-skew-ok-123456");

  const expired = await signHandoff(SECRET, {
    jti: "jti-expired-123456",
    iat: now - 120,
    exp: now - (SSO_CLOCK_SKEW_SECONDS + 5),
  });
  await assert.rejects(() => verifySsoHandoffToken(expired, SECRET), SsoTokenError);
});

test("GET /api/sso/callback redeems jti, opens a Sales session, and does not provision users", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sales-sso-"));
  const dbFile = path.join(dir, "sso.db");
  process.env.SSO_SHARED_SECRET = SECRET;
  process.env.NEXTAUTH_SECRET = SESSION_SECRET;
  process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
  process.env.TURSO_DATABASE_URL = `file:${dbFile}`;
  delete process.env.TURSO_AUTH_TOKEN;

  const logged: unknown[][] = [];
  const originalError = console.error;
  const originalInfo = console.info;
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  console.info = (...args: unknown[]) => {
    logged.push(args);
  };

  try {
    const setup = createClient({ url: `file:${dbFile}` });
    await setup.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        signature_path TEXT
      )
    `);
    await setup.execute({
      sql: "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
      args: ["alice@example.com", "not-used", "Alice Email", "accountant"],
    });
    await setup.execute({
      sql: "INSERT INTO users (username, password, full_name, role, signature_path) VALUES (?, ?, ?, ?, ?)",
      args: ["alice", "not-used", "Alice Name", "sales_officer", "/sig.png"],
    });
    await setup.execute({
      sql: "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
      args: ["Richard", "not-used", "Richard Mugisha", "sales_officer"],
    });
    setup.close();

    const { GET } = await import("../app/api/sso/callback/route");

    const callbackUrl = (token: string) =>
      `http://127.0.0.1:3000/api/sso/callback?token=${encodeURIComponent(token)}`;

    const missing = await GET(new Request("http://127.0.0.1:3000/api/sso/callback"));
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get("cache-control"), "no-store");

    const emailWins = await signHandoff(SECRET, {
      email: "Alice@Example.com",
      username: "alice",
      jti: "jti-email-wins-1234",
    });
    const emailResponse = await GET(new Request(callbackUrl(emailWins)));
    assert.equal(emailResponse.status, 302);
    assert.equal(emailResponse.headers.get("location"), "http://127.0.0.1:3000/dashboard");
    assert.equal(emailResponse.headers.get("location")!.includes("token"), false);
    assert.equal(emailResponse.headers.get("cache-control"), "no-store");
    assert.equal(emailResponse.headers.get("referrer-policy"), "no-referrer");

    const setCookies = emailResponse.headers.getSetCookie();
    const sessionCookie = setCookies.find((cookie) =>
      cookie.startsWith("next-auth.session-token=")
    );
    assert.ok(sessionCookie, "expected a NextAuth session cookie");
    assert.match(sessionCookie, /HttpOnly/i);
    assert.match(sessionCookie, /SameSite=Lax/i);
    assert.doesNotMatch(sessionCookie, /;\s*Secure/i);
    const sessionValue = sessionCookie.slice("next-auth.session-token=".length).split(";")[0];
    const payload = await decode({ token: sessionValue, secret: SESSION_SECRET });
    assert.ok(payload);
    assert.equal(payload.email, "alice@example.com");
    assert.equal(payload.role, "accountant");
    assert.equal(payload.name, "Alice Email");
    assert.equal(payload.id, payload.sub);

    const replay = await GET(new Request(callbackUrl(emailWins)));
    assert.equal(replay.status, 401);
    const replayBody = await replay.json();
    assert.match(replayBody.error, /already been used/i);
    assert.equal(
      replay.headers.getSetCookie().some((cookie) => cookie.startsWith("next-auth.session-token=")),
      false
    );

    const usernameFallback = await signHandoff(SECRET, {
      email: "missing@example.com",
      username: "richard",
      jti: "jti-username-123456",
    });
    const usernameResponse = await GET(new Request(callbackUrl(usernameFallback)));
    assert.equal(usernameResponse.status, 302);
    const usernameCookie = usernameResponse.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("next-auth.session-token="));
    assert.ok(usernameCookie);
    const usernamePayload = await decode({
      token: usernameCookie.slice("next-auth.session-token=".length).split(";")[0],
      secret: SESSION_SECRET,
    });
    assert.equal(usernamePayload?.name, "Richard Mugisha");
    assert.equal(usernamePayload?.email, "Richard");
    assert.equal(usernamePayload?.signature_path, undefined);

    const unknown = await signHandoff(SECRET, {
      email: "nobody@example.com",
      username: "nobody",
      jti: "jti-nobody-12345678",
    });
    const forbidden = await GET(new Request(callbackUrl(unknown)));
    assert.equal(forbidden.status, 403);
    const forbiddenBody = await forbidden.json();
    assert.match(forbiddenBody.error, /No Sales user matches/i);

    const check = createClient({ url: `file:${dbFile}` });
    const count = await check.execute("SELECT COUNT(*) AS n FROM users");
    assert.equal(Number(count.rows[0].n), 3);
    const redeemed = await check.execute("SELECT jti FROM sso_redeemed_jtis ORDER BY jti");
    const redeemedIds = redeemed.rows.map((row) => String(row.jti));
    assert.deepEqual(redeemedIds, [
      "jti-email-wins-1234",
      "jti-nobody-12345678",
      "jti-username-123456",
    ]);
    check.close();

    const { redeemSsoJti } = await import("./sso-jti");
    const boundaryExp = Math.floor(Date.now() / 1000) - SSO_CLOCK_SKEW_SECONDS;
    assert.equal(await redeemSsoJti("jti-boundary-12345", boundaryExp), true);
    assert.equal(await redeemSsoJti("jti-boundary-12345", boundaryExp), false);

    process.env.NEXTAUTH_URL = "https://sales.eastafricanspirit.co.tz";
    const httpsToken = await signHandoff(SECRET, {
      email: "missing@example.com",
      username: "Richard",
      jti: "jti-https-cookie-123",
    });
    const httpsResponse = await GET(
      new Request(
        `https://evil.example/api/sso/callback?token=${encodeURIComponent(httpsToken)}&next=https://evil.example`
      )
    );
    assert.equal(httpsResponse.status, 302);
    assert.equal(
      httpsResponse.headers.get("location"),
      "https://sales.eastafricanspirit.co.tz/dashboard"
    );
    const secureCookie = httpsResponse.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith("__Secure-next-auth.session-token="));
    assert.ok(secureCookie);
    assert.match(secureCookie, /Secure/i);

    process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
    process.env.SSO_SHARED_SECRET = "short";
    const shortSecret = await GET(new Request(callbackUrl(httpsToken)));
    assert.equal(shortSecret.status, 500);

    process.env.SSO_SHARED_SECRET = SESSION_SECRET;
    const notDistinct = await GET(new Request(callbackUrl(httpsToken)));
    assert.equal(notDistinct.status, 500);

    const loggedText = JSON.stringify(logged);
    assert.equal(loggedText.includes(emailWins), false);
    assert.equal(loggedText.includes(usernameFallback), false);
    assert.equal(loggedText.includes(unknown), false);
    assert.equal(loggedText.includes(httpsToken), false);
    assert.equal(loggedText.includes(SECRET), false);
    assert.equal(loggedText.includes(SESSION_SECRET), false);
  } finally {
    console.error = originalError;
    console.info = originalInfo;
    rmSync(dir, { recursive: true, force: true });
  }
});
