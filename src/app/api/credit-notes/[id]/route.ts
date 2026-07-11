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

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can edit credit notes" }, { status: 403 });
  }

  try {
    await ensureFinanceTables();

    const id = parseInt(params.id);
    const body = await req.json();
    const { request_id, reason, credit_date, items } = body;

    if (!reason || !items?.length) {
      return NextResponse.json({ error: "Reason and at least one line are required" }, { status: 400 });
    }
    for (const item of items) {
      const qty   = Number(item.quantity);
      const price = Number(item.unit_price);
      if (!item.product_id && !item.description) {
        return NextResponse.json({ error: "Each line needs a product or a description" }, { status: 400 });
      }
      if (!(qty > 0) || !(price > 0)) {
        return NextResponse.json({ error: "Quantities and amounts must be greater than zero" }, { status: 400 });
      }
    }

    const existing = await db.execute({
      sql: "SELECT id FROM credit_notes WHERE id = ?",
      args: [id],
    });
    if (!existing.rows.length) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    const date = credit_date && /^\d{4}-\d{2}-\d{2}$/.test(credit_date)
      ? credit_date
      : new Date().toISOString().slice(0, 10);

    // Replace header fields and all lines; status is untouched so an
    // approved credit note stays approved after an admin correction.
    await db.batch(
      [
        {
          sql: "UPDATE credit_notes SET request_id = ?, reason = ?, credit_date = ? WHERE id = ?",
          args: [request_id || null, reason, date, id],
        },
        {
          sql: "DELETE FROM credit_note_items WHERE credit_note_id = ?",
          args: [id],
        },
        ...items.map((item: { product_id?: number; description?: string; quantity: number; unit_price: number }) => ({
          sql: `INSERT INTO credit_note_items (credit_note_id, product_id, description, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            id,
            item.product_id || null,
            item.description || null,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
          ],
        })),
      ],
      "write"
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /credit-notes/[id] PUT]", err);
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

    // Admins can delete any credit note regardless of status; balances and
    // dashboard revenue are computed live so they adjust automatically.
    // Lines are removed explicitly in case the connection has FKs disabled.
    const [, result] = await db.batch(
      [
        { sql: "DELETE FROM credit_note_items WHERE credit_note_id = ?", args: [parseInt(params.id)] },
        { sql: "DELETE FROM credit_notes WHERE id = ?", args: [parseInt(params.id)] },
      ],
      "write"
    );

    if (!result.rowsAffected) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /credit-notes/[id] DELETE]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
