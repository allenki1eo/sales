import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import test from "node:test";
import bcrypt from "bcryptjs";
import { createClient } from "@libsql/client";
import { verifySsoToken } from "./sso";

const SSO_SECRET = "test-sso-shared-secret-value";
const DB_PATH = "/tmp/sales-sso-test.db";

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function mint(
  claims: Record<string, unknown>,
  secret = SSO_SECRET,
  header: Record<string, unknown> = { alg: "HS256", typ: "JWT" }
): string {
  const encodedHeader = b64(header);
  const encodedPayload = b64(claims);
  const data = `${encodedHeader}.${encodedPayload}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function validClaims(overrides: Record<string, unknown> = {}, now = Math.floor(Date.now() / 1000)) {
  return {
    sub: "ims-user-1",
    email: "loreen@example.com",
    username: "Loreen",
    name: "Loreen Tarimo",
    aud: "sales",
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + 90,
    ...overrides,
  };
}

test("accepts a short-lived sales audience token", () => {
  const result = verifySsoToken(mint(validClaims()), SSO_SECRET);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.identity.email, "loreen@example.com");
  assert.equal(result.identity.username, "Loreen");
  assert.equal(result.identity.name, "Loreen Tarimo");
  assert.equal(result.identity.sub, "ims-user-1");
});

function failureReason(token: string, secret: string | undefined = SSO_SECRET): string {
  const result = verifySsoToken(token, secret);
  if (result.ok) assert.fail("expected token to be rejected");
  return result.reason;
}

test("rejects a missing secret, bad signature, audience, lifetime, and alg none", () => {
  const claims = validClaims();
  const missingSecret = verifySsoToken(mint(claims), undefined);
  assert.equal(missingSecret.ok, false);
  if (!missingSecret.ok) assert.equal(missingSecret.reason, "not_configured");
  assert.equal(failureReason(mint(claims), "other-secret"), "invalid");
  assert.equal(failureReason(mint({ ...claims, aud: "ims" })), "invalid");
  assert.equal(failureReason(mint({ ...claims, aud: ["sales"] })), "invalid");

  const now = Math.floor(Date.now() / 1000);
  assert.equal(failureReason(mint(validClaims({ iat: now, exp: now + 300 }))), "invalid");
  assert.equal(failureReason(mint(validClaims({ iat: now - 200, exp: now - 80 }))), "expired");

  const noneHeader = b64({ alg: "none", typ: "JWT" });
  const nonePayload = b64(claims);
  assert.equal(failureReason(`${noneHeader}.${nonePayload}.`), "invalid");
  assert.equal(failureReason(mint(claims, SSO_SECRET, { alg: "RS256", typ: "JWT" })), "invalid");
  assert.equal(failureReason(mint({ ...claims, email: "not-an-email" })), "invalid");
  assert.equal(failureReason(mint({ ...claims, email: undefined, username: undefined })), "invalid");
});

test("callback matches users, preserves passwords, and opens a NextAuth session", async () => {
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  process.env.TURSO_DATABASE_URL = `file:${DB_PATH}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
  process.env.NEXTAUTH_SECRET = "test-nextauth-secret-test-nextauth-secret";
  process.env.SSO_SHARED_SECRET = SSO_SECRET;
  delete process.env.VERCEL;
  delete process.env.AUTH_TRUST_HOST;

  const admin = createClient({ url: process.env.TURSO_DATABASE_URL });
  await admin.execute(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'sales_officer'
      CHECK (role IN ('admin','accountant','sales_officer')),
    signature_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const loreenHash = await bcrypt.hash("loreen-password", 4);
  const accountantHash = await bcrypt.hash("accountant-password", 4);
  await admin.execute({
    sql: "INSERT INTO users (username, password, full_name, role, signature_path) VALUES (?, ?, ?, ?, ?)",
    args: ["Loreen", loreenHash, "Loreen Tarimo", "accountant", "signatures/loreen.png"],
  });
  await admin.execute({
    sql: "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)",
    args: ["boss@example.com", accountantHash, "Boss", "admin"],
  });

  const { GET } = await import("../app/api/sso/callback/route");
  const { decode } = await import("next-auth/jwt");
  const { authOptions } = await import("./auth");
  const { NextRequest } = await import("next/server");

  const authorize = (
    authOptions.providers[0] as unknown as {
      options: {
        authorize: (credentials?: { username?: string; password?: string }) => Promise<{
          id: string;
          role?: string;
        } | null>;
      };
    }
  ).options.authorize;

  const signedIn = await authorize({ username: "Loreen", password: "loreen-password" });
  assert.equal(signedIn?.role, "accountant");
  assert.equal(await authorize({ username: "Loreen", password: "wrong" }), null);
  assert.equal(await authorize({ username: "Loreen", password: "" }), null);
  assert.equal(await authorize({ username: "Loreen" }), null);

  const loreenToken = mint(validClaims({ username: "loreen", email: "someone-else@example.com" }));
  assert.equal(await authorize({ username: "Loreen", password: loreenToken }), null);

  async function callback(token: string) {
    return GET(new NextRequest(`http://127.0.0.1:3000/api/sso/callback?token=${encodeURIComponent(token)}`));
  }

  const matched = await callback(loreenToken);
  assert.equal(matched.status, 302);
  const location = matched.headers.get("location") ?? "";
  assert.equal(location, "/dashboard");
  assert.equal(location.includes("token="), false);
  const setCookie = matched.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /next-auth\.session-token=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Max-Age=28800/);
  assert.doesNotMatch(setCookie, /Secure/i);
  assert.equal(setCookie.includes(loreenToken), false);
  const sessionCookie = matched.cookies.get("next-auth.session-token");
  assert.ok(sessionCookie);
  const session = await decode({
    token: sessionCookie.value,
    secret: process.env.NEXTAUTH_SECRET,
  });
  assert.equal(session?.role, "accountant");
  assert.equal(session?.name, "Loreen Tarimo");
  assert.equal(session?.email, "Loreen");
  assert.equal(session?.signature_path, "signatures/loreen.png");
  assert.equal(matched.headers.get("referrer-policy"), "no-referrer");

  const hashAfter = await admin.execute("SELECT password FROM users WHERE username = 'Loreen'");
  assert.equal(String(hashAfter.rows[0].password), loreenHash);

  const replay = await callback(loreenToken);
  assert.equal(replay.status, 401);
  assert.equal(replay.headers.get("set-cookie"), null);
  const replayBody = await replay.text();
  assert.equal(replayBody.includes(loreenToken), false);
  assert.match(replayBody, /already used/);

  const preferred = mint(
    validClaims({
      email: "boss@example.com",
      username: "Loreen",
      name: "Should Not Rename",
    })
  );
  const preferredRes = await callback(preferred);
  const preferredSession = await decode({
    token: preferredRes.cookies.get("next-auth.session-token")!.value,
    secret: process.env.NEXTAUTH_SECRET!,
  });
  assert.equal(preferredSession?.role, "admin");
  assert.equal(preferredSession?.name, "Boss");

  const before = await admin.execute("SELECT COUNT(*) AS n FROM users");
  const createdToken = mint(
    validClaims({
      sub: "ims-new-1",
      email: "new.officer@example.com",
      username: "brand-new",
      name: "New Officer",
    })
  );
  const createdRes = await callback(createdToken);
  assert.equal(createdRes.status, 302);
  const createdSession = await decode({
    token: createdRes.cookies.get("next-auth.session-token")!.value,
    secret: process.env.NEXTAUTH_SECRET!,
  });
  assert.equal(createdSession?.role, "sales_officer");
  assert.equal(createdSession?.email, "new.officer@example.com");
  assert.equal(createdSession?.name, "New Officer");
  const after = await admin.execute(
    "SELECT password, role FROM users WHERE username = 'new.officer@example.com'"
  );
  assert.equal(String(after.rows[0].role), "sales_officer");
  assert.equal(await bcrypt.compare("password", String(after.rows[0].password)), false);
  assert.equal(await bcrypt.compare("", String(after.rows[0].password)), false);
  const count = await admin.execute("SELECT COUNT(*) AS n FROM users");
  assert.equal(Number(count.rows[0].n), Number(before.rows[0].n) + 1);

  const bad = await callback(mint(validClaims({ aud: "warehouse" })));
  assert.equal(bad.status, 401);
  assert.match(await bad.text(), /invalid or has expired/);

  const missing = await GET(new NextRequest("http://127.0.0.1:3000/api/sso/callback"));
  assert.equal(missing.status, 400);

  const saved = process.env.SSO_SHARED_SECRET;
  delete process.env.SSO_SHARED_SECRET;
  const unconfigured = await callback(mint(validClaims()));
  assert.equal(unconfigured.status, 503);
  process.env.SSO_SHARED_SECRET = saved;

  process.env.NEXTAUTH_URL = "https://sales.example.com";
  const secureRes = await callback(mint(validClaims({ email: undefined, username: "Loreen" })));
  assert.equal(secureRes.status, 302);
  const secureCookie = secureRes.headers.get("set-cookie") ?? "";
  assert.match(secureCookie, /__Secure-next-auth\.session-token=/);
  assert.match(secureCookie, /Secure/i);
  const secureSession = await decode({
    token: secureRes.cookies.get("__Secure-next-auth.session-token")!.value,
    secret: process.env.NEXTAUTH_SECRET!,
  });
  assert.equal(secureSession?.role, "accountant");

  const { sessionTokenCookie } = await import("./session-token");
  assert.equal(sessionTokenCookie().name, "__Secure-next-auth.session-token");
  assert.equal(sessionTokenCookie("http").name, "__Secure-next-auth.session-token");
  process.env.VERCEL = "1";
  assert.equal(sessionTokenCookie("http").name, "next-auth.session-token");
  assert.equal(sessionTokenCookie("https").options.secure, true);
  delete process.env.VERCEL;
  process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";

  admin.close();
});
