import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { ensureFinanceTables } from "@/lib/finance-schema";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureFinanceTables();

    const note = await db.execute({
      sql: `SELECT cn.*, c.name as customer_name, c.location as customer_location,
                   c.phone as customer_phone, c.is_export,
                   u.full_name as user_name, a.full_name as approved_by_name
            FROM credit_notes cn
            JOIN customers c ON cn.customer_id = c.id
            JOIN users u ON cn.user_id = u.id
            LEFT JOIN users a ON cn.approved_by = a.id
            WHERE cn.id = ?`,
      args: [parseInt(params.id)],
    });

    if (!note.rows.length) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    const items = await db.execute({
      sql: `SELECT cni.*, p.name as product_name
            FROM credit_note_items cni
            LEFT JOIN products p ON cni.product_id = p.id
            WHERE cni.credit_note_id = ?
            ORDER BY cni.id ASC`,
      args: [parseInt(params.id)],
    });

    return NextResponse.json({ ...note.rows[0], items: items.rows });
  } catch (err: any) {
    console.error("[API /credit-notes/[id] GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can approve or reject credit notes" }, { status: 403 });
  }

  try {
    await ensureFinanceTables();

    const { status } = await req.json();
    if (!["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Status must be 'approved' or 'rejected'" }, { status: 400 });
    }

    const result = await db.execute({
      sql: `UPDATE credit_notes
            SET status = ?, approved_by = ?, approved_at = datetime('now')
            WHERE id = ? AND status = 'pending'`,
      args: [status, parseInt(session.user.id), parseInt(params.id)],
    });

    if (!result.rowsAffected) {
      return NextResponse.json({ error: "Credit note not found or already processed" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /credit-notes/[id] PATCH]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete credit notes" }, { status: 403 });
  }

  try {
    await ensureFinanceTables();

    const result = await db.execute({
      sql: "DELETE FROM credit_notes WHERE id = ? AND status = 'pending'",
      args: [parseInt(params.id)],
    });

    if (!result.rowsAffected) {
      return NextResponse.json({ error: "Only pending credit notes can be deleted" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /credit-notes/[id] DELETE]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
