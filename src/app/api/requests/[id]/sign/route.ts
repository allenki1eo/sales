import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { sendOrderEvent, sendKpiUpdate } from "@/lib/ims-webhook";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "accountant" && role !== "admin") {
    return NextResponse.json({ error: "You do not have permission to approve requests" }, { status: 403 });
  }

  const now = new Date().toISOString();

  try {
    await db.batch([
      {
        sql: `DELETE FROM request_signatures WHERE request_id = ? AND signature_type = 'approved_by'`,
        args: [params.id],
      },
      {
        sql: `INSERT INTO request_signatures (request_id, signer_id, signature_type, signed_at)
              VALUES (?, ?, 'approved_by', ?)`,
        args: [params.id, session.user.id, now],
      },
      {
        sql: "UPDATE requests SET status = 'approved' WHERE id = ?",
        args: [params.id],
      },
    ], "write");

    const month = new Date().toISOString().slice(0, 7);
    void sendOrderEvent("order.updated", params.id);
    void sendKpiUpdate(month);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[API /requests/:id/sign POST]", err);
    return NextResponse.json({ error: err.message || "Failed to approve request" }, { status: 500 });
  }
}
