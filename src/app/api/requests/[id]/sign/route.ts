import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "accountant" && role !== "admin") {
    return NextResponse.json({ error: "You do not have permission to approve requests" }, { status: 403 });
  }

  const now = new Date().toISOString();

  await db.batch([
    {
      sql: `INSERT INTO request_signatures (request_id, signer_id, signature_type, signed_at)
            VALUES (?, ?, 'approved_by', ?)
            ON CONFLICT (request_id, signature_type) DO UPDATE SET signer_id = excluded.signer_id, signed_at = excluded.signed_at`,
      args: [params.id, session.user.id, now],
    },
    {
      sql: "UPDATE requests SET status = 'approved' WHERE id = ?",
      args: [params.id],
    },
  ], "write");

  return NextResponse.json({ success: true });
}
