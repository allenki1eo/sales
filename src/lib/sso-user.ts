import db from "@/lib/db";

export interface LocalSalesUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  signaturePath: string | null;
}

/**
 * Sales users have no email column; `users.username` is the login id
 * (and is what NextAuth stores in the session `email` field).
 * Match that column against the IMS email first, then the IMS username.
 * Never creates a user — there is no SSO provisioning path in this app.
 */
export async function findLocalUserForSso(identity: {
  email: string;
  username: string;
}): Promise<LocalSalesUser | null> {
  const email = identity.email.trim();
  const username = identity.username.trim();

  if (email) {
    const byEmail = await findByUsername(email);
    if (byEmail) return byEmail;
  }

  if (username && username.toLowerCase() !== email.toLowerCase()) {
    return findByUsername(username);
  }

  return null;
}

async function findByUsername(username: string): Promise<LocalSalesUser | null> {
  const result = await db.execute({
    sql: `SELECT id, username, full_name, role, signature_path
          FROM users
          WHERE lower(username) = lower(?)
          LIMIT 1`,
    args: [username],
  });
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    username: String(row.username),
    fullName: String(row.full_name),
    role: String(row.role),
    signaturePath: row.signature_path == null ? null : String(row.signature_path),
  };
}
