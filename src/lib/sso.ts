import crypto from "crypto";
import bcrypt from "bcryptjs";
import db from "@/lib/db";

const SSO_AUDIENCE = "sales";
const MAX_TOKEN_TTL_SECONDS = 120;
const CLOCK_SKEW_SECONDS = 10;
const MAX_TOKEN_LENGTH = 4096;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const JTI_RE = /^[A-Za-z0-9_-]{8,200}$/;

export type SsoIdentity = {
  sub: string;
  jti: string;
  exp: number;
  email?: string;
  username?: string;
  name?: string;
};

export type SsoVerifyFailure = "not_configured" | "invalid" | "expired";

export type SsoVerifyResult =
  | { ok: true; identity: SsoIdentity }
  | { ok: false; reason: SsoVerifyFailure };

export type SalesUser = {
  id: string;
  username: string;
  full_name: string;
  role: string;
  signature_path?: string;
};

type UserRow = {
  id: number | bigint | string;
  username: string;
  full_name: string;
  role: string;
  signature_path: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64UrlJson(segment: string): unknown {
  const json = Buffer.from(segment, "base64url").toString("utf8");
  return JSON.parse(json);
}

function signaturesMatch(expected: Buffer, actual: Buffer): boolean {
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, 120);
}

function optionalEmail(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  return email;
}

function optionalUsername(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return null;
  const username = value.trim();
  if (!USERNAME_RE.test(username)) return null;
  return username;
}

/**
 * Verify an IMS launch token.
 * HS256 only, audience must be the string "sales", lifetime at most 120s.
 * Does not log the token.
 */
export function verifySsoToken(token: string, secret: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)): SsoVerifyResult {
  if (!secret) return { ok: false, reason: "not_configured" };
  if (!token || token.length > MAX_TOKEN_LENGTH || token.includes(" ") || token.split(".").length !== 3) {
    return { ok: false, reason: "invalid" };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { ok: false, reason: "invalid" };
  }

  let header: Record<string, unknown>;
  try {
    const parsed = decodeBase64UrlJson(encodedHeader);
    if (!isRecord(parsed)) return { ok: false, reason: "invalid" };
    header = parsed;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  // Ignore the header's alg for the MAC itself — only HS256 is accepted.
  if (header.alg !== "HS256" || header.crit !== undefined) {
    return { ok: false, reason: "invalid" };
  }
  if (header.typ !== undefined && header.typ !== "JWT") {
    return { ok: false, reason: "invalid" };
  }

  const expected = crypto.createHmac("sha256", secret).update(`${encodedHeader}.${encodedPayload}`).digest();
  const actual = Buffer.from(encodedSignature, "base64url");
  if (!signaturesMatch(expected, actual)) return { ok: false, reason: "invalid" };

  let payload: Record<string, unknown>;
  try {
    const parsed = decodeBase64UrlJson(encodedPayload);
    if (!isRecord(parsed)) return { ok: false, reason: "invalid" };
    payload = parsed;
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (payload.aud !== SSO_AUDIENCE) return { ok: false, reason: "invalid" };

  const { sub, jti, iat, exp, nbf } = payload;
  if (typeof sub !== "string" || !JTI_RE.test(sub)) return { ok: false, reason: "invalid" };
  if (typeof jti !== "string" || !JTI_RE.test(jti)) return { ok: false, reason: "invalid" };
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return { ok: false, reason: "invalid" };
  if ((exp as number) - (iat as number) <= 0 || (exp as number) - (iat as number) > MAX_TOKEN_TTL_SECONDS) {
    return { ok: false, reason: "invalid" };
  }
  if (nbf !== undefined && (!Number.isInteger(nbf) || (nbf as number) > nowSeconds + CLOCK_SKEW_SECONDS)) {
    return { ok: false, reason: "invalid" };
  }
  if ((iat as number) > nowSeconds + CLOCK_SKEW_SECONDS) return { ok: false, reason: "invalid" };
  if (nowSeconds - (iat as number) > MAX_TOKEN_TTL_SECONDS + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "expired" };
  }
  if ((exp as number) + CLOCK_SKEW_SECONDS < nowSeconds) return { ok: false, reason: "expired" };

  const email = optionalEmail(payload.email);
  const username = optionalUsername(payload.username);
  if (email === null || username === null) return { ok: false, reason: "invalid" };
  if (!email && !username) return { ok: false, reason: "invalid" };

  return {
    ok: true,
    identity: {
      sub,
      jti,
      exp: exp as number,
      email,
      username,
      name: cleanName(payload.name),
    },
  };
}

let ssoTablesReady: Promise<void> | null = null;

function ensureSsoTables(): Promise<void> {
  if (!ssoTablesReady) {
    ssoTablesReady = db
      .execute(
        `CREATE TABLE IF NOT EXISTS sso_consumed_jti (
           jti        TEXT    PRIMARY KEY,
           expires_at INTEGER NOT NULL
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        ssoTablesReady = null;
        throw err;
      });
  }
  return ssoTablesReady;
}

function isConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /constraint/i.test(message);
}

/** Returns false when this jti was already consumed. */
export async function consumeSsoJti(jti: string, exp: number): Promise<boolean> {
  await ensureSsoTables();
  const now = Math.floor(Date.now() / 1000);
  await db.execute({
    sql: "DELETE FROM sso_consumed_jti WHERE expires_at < ?",
    args: [now],
  });
  try {
    await db.execute({
      sql: "INSERT INTO sso_consumed_jti (jti, expires_at) VALUES (?, ?)",
      args: [jti, exp],
    });
    return true;
  } catch (err) {
    if (isConstraintError(err)) return false;
    throw err;
  }
}

function mapUser(row: UserRow): SalesUser {
  return {
    id: String(row.id),
    username: String(row.username),
    full_name: String(row.full_name),
    role: String(row.role),
    signature_path: row.signature_path ? String(row.signature_path) : undefined,
  };
}

async function findUserByUsername(username: string): Promise<SalesUser | null> {
  const result = await db.execute({
    sql: `SELECT id, username, full_name, role, signature_path
          FROM users
          WHERE username = ? COLLATE NOCASE
          LIMIT 1`,
    args: [username],
  });
  const row = result.rows[0] as unknown as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export type ResolveUserResult =
  | { ok: true; user: SalesUser; created: boolean }
  | { ok: false; reason: "unprovisioned"; username: string };

/**
 * Match an existing Sales user by email (preferred) then username.
 * Does not change an existing user's role or password.
 * If nobody matches, create a sales_officer — the schema and admin-form
 * default, and the least-privileged role. The password is random so the
 * credentials form cannot be used until an admin replaces the account.
 */
export async function findOrCreateSsoUser(identity: SsoIdentity): Promise<ResolveUserResult> {
  if (identity.email) {
    const byEmail = await findUserByUsername(identity.email);
    if (byEmail) return { ok: true, user: byEmail, created: false };
  }

  if (identity.username && identity.username.toLowerCase() !== identity.email?.toLowerCase()) {
    const byUsername = await findUserByUsername(identity.username);
    if (byUsername) return { ok: true, user: byUsername, created: false };
  }

  const username = identity.email ?? identity.username ?? "";
  if (username.length < 3) {
    return { ok: false, reason: "unprovisioned", username };
  }

  const fullName = identity.name || username;
  const password = crypto.randomBytes(32).toString("base64url");
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    await db.execute({
      sql: "INSERT INTO users (username, full_name, password, role) VALUES (?, ?, ?, 'sales_officer')",
      args: [username, fullName, hashedPassword],
    });
  } catch (err) {
    if (!isConstraintError(err)) throw err;
    const existing = await findUserByUsername(username);
    if (existing) return { ok: true, user: existing, created: false };
    throw err;
  }

  const created = await findUserByUsername(username);
  if (!created) return { ok: false, reason: "unprovisioned", username };
  return { ok: true, user: created, created: true };
}
