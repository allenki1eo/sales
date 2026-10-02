import { decodeProtectedHeader, jwtVerify, type JWTPayload } from "jose";

/** Must match the `aud` claim IMS sets when launching Sales. */
export const SSO_AUDIENCE = "sales";

/** A few seconds of clock skew between IMS and Sales. Tokens past this are rejected. */
export const SSO_CLOCK_SKEW_SECONDS = 15;

/** Same minimum IMS enforces before it will sign a handoff token. */
export const SSO_MIN_SECRET_LENGTH = 32;

const MAX_TOKEN_LENGTH = 4096;

export class SsoConfigError extends Error {
  constructor(readonly reason: "missing" | "not_distinct") {
    super(reason);
    this.name = "SsoConfigError";
  }
}

export class SsoTokenError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "SsoTokenError";
  }
}

export interface SsoIdentity {
  sub: string;
  email: string;
  username: string;
  name: string;
  jti: string;
  /** Token `exp` in unix seconds. */
  exp: number;
}

/**
 * Shared HS256 secret. Distinct from NEXTAUTH_SECRET so a session-key leak
 * cannot mint handoff tokens, and the reverse.
 */
export function ssoSharedSecret(): string {
  const secret = process.env.SSO_SHARED_SECRET?.trim() ?? "";
  if (secret.length < SSO_MIN_SECRET_LENGTH) {
    throw new SsoConfigError("missing");
  }
  const sessionSecret = process.env.NEXTAUTH_SECRET?.trim() ?? "";
  if (sessionSecret && secret === sessionSecret) {
    throw new SsoConfigError("not_distinct");
  }
  return secret;
}

function claimString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Verify an IMS handoff JWT.
 * Algorithm is pinned to HS256: `none` and asymmetric algs are rejected
 * before the signature check. A `password` claim is ignored — IMS does not send one.
 */
export async function verifySsoHandoffToken(
  token: string,
  secret: string
): Promise<SsoIdentity> {
  if (!token || token.length > MAX_TOKEN_LENGTH || token.includes(" ")) {
    throw new SsoTokenError("malformed");
  }

  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new SsoTokenError("malformed");
  }
  if (alg !== "HS256") {
    throw new SsoTokenError("alg");
  }

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
      audience: SSO_AUDIENCE,
      clockTolerance: SSO_CLOCK_SKEW_SECONDS,
    });
    payload = verified.payload;
  } catch {
    throw new SsoTokenError("invalid");
  }

  // jose accepts `aud: ["sales", ...]`. This app must be the only audience.
  if (payload.aud !== SSO_AUDIENCE) {
    throw new SsoTokenError("aud");
  }
  if (typeof payload.exp !== "number") {
    throw new SsoTokenError("exp");
  }

  const sub = claimString(payload.sub);
  const email = claimString(payload.email);
  const username = claimString(payload.username);
  const jti = claimString(payload.jti);
  if (!sub) throw new SsoTokenError("sub");
  if (!email) throw new SsoTokenError("email");
  if (!username) throw new SsoTokenError("username");
  if (!jti || jti.length < 8 || jti.length > 128) throw new SsoTokenError("jti");

  const name = claimString(payload.name) ?? "";
  return { sub, email, username, name, jti, exp: payload.exp };
}
