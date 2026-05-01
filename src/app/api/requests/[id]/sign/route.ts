import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "accountant" && role !== "admin") {
    return NextResponse.json({ error: "Only accountants can approve requests" }, { status: 403 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO request_signatures (request_id, signature_type, user_id, signed_at)
       VALUES (?, 'approved_by', ?, NOW())
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), signed_at = NOW()`,
      [params.id, session.user.id]
    );

    await conn.execute(
      "UPDATE requests SET status = 'approved', updated_at = NOW() WHERE id = ?",
      [params.id]
    );

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Failed to sign request" }, { status: 500 });
  } finally {
    conn.release();
  }
}
