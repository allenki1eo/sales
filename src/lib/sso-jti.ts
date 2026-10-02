import db from "@/lib/db";
import { SSO_CLOCK_SKEW_SECONDS } from "@/lib/sso";

let ensured: Promise<void> | null = null;

/** Durable single-use ledger. In-memory storage is not shared across serverless isolates. */
export function ensureSsoJtiTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sso_redeemed_jtis (
          jti        TEXT    PRIMARY KEY,
          expires_at INTEGER NOT NULL
        )
      `);
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_sso_redeemed_jtis_expires_at
          ON sso_redeemed_jtis (expires_at)
      `);
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

/**
 * Record `jti` until after `exp` (plus clock skew). Returns false if it was already redeemed.
 * The raw handoff token is never stored.
 * Rows are deleted only once `expires_at` is strictly in the past, so a token still inside
 * the skew window cannot be inserted again.
 */
export async function redeemSsoJti(jti: string, exp: number): Promise<boolean> {
  await ensureSsoJtiTable();
  const now = Math.floor(Date.now() / 1000);
  const keepUntil = exp + SSO_CLOCK_SKEW_SECONDS;

  await db.execute({
    sql: "DELETE FROM sso_redeemed_jtis WHERE expires_at < ?",
    args: [now],
  });

  const inserted = await db.execute({
    sql: "INSERT OR IGNORE INTO sso_redeemed_jtis (jti, expires_at) VALUES (?, ?)",
    args: [jti, keepUntil],
  });
  return Number(inserted.rowsAffected) === 1;
}
