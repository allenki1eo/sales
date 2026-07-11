import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { ensureFinanceTables, nextCreditNoteNumber } from "@/lib/finance-schema";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureFinanceTables();

    const { searchParams } = new URL(req.url);
    const page        = parseInt(searchParams.get("page")  || "1");
    const limit       = parseInt(searchParams.get("limit") || "10");
    const search      = searchParams.get("search") || "";
    const status      = searchParams.get("status") || "";
    const customerId  = searchParams.get("customer_id") || "";
    const offset      = (page - 1) * limit;

    let where = "WHERE 1=1";
    const args: (string | number)[] = [];

    if (search) {
      where += " AND (c.name LIKE ? OR cn.credit_note_no LIKE ? OR cn.reason LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      where += " AND cn.status = ?";
      args.push(status);
    }
    if (customerId) {
      where += " AND cn.customer_id = ?";
      args.push(parseInt(customerId));
    }

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM credit_notes cn JOIN customers c ON cn.customer_id = c.id ${where}`,
      args,
    });

    const rows = await db.execute({
      sql: `SELECT cn.id, cn.credit_note_no, cn.status, cn.reason, cn.credit_date,
                   cn.request_id, cn.created_at,
                   c.name as customer_name, u.full_name as user_name,
                   COALESCE(SUM(cni.total_price), 0) as total_amount
            FROM credit_notes cn
            JOIN customers c ON cn.customer_id = c.id
            JOIN users u ON cn.user_id = u.id
            LEFT JOIN credit_note_items cni ON cni.credit_note_id = cn.id
            ${where}
            GROUP BY cn.id
            ORDER BY cn.created_at DESC
            LIMIT ? OFFSET ?`,
      args: [...args, limit, offset],
    });

    const total = Number(countResult.rows[0].total) || 0;

    return NextResponse.json({
      data: rows.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    console.error("[API /credit-notes GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "accountant"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only admins and accountants can create credit notes" }, { status: 403 });
  }

  try {
    await ensureFinanceTables();

    const body = await req.json();
    const { customer_id, request_id, reason, credit_date, items } = body;

    if (!customer_id || !reason || !items?.length) {
      return NextResponse.json({ error: "Customer, reason and at least one line are required" }, { status: 400 });
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

    const date = credit_date && /^\d{4}-\d{2}-\d{2}$/.test(credit_date)
      ? credit_date
      : new Date().toISOString().slice(0, 10);

    const creditNoteNo = await nextCreditNoteNumber();

    const insert = await db.execute({
      sql: `INSERT INTO credit_notes (credit_note_no, customer_id, request_id, user_id, reason, credit_date, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      args: [creditNoteNo, customer_id, request_id || null, parseInt(session.user.id), reason, date],
    });

    const creditNoteId = Number(insert.lastInsertRowid);

    await db.batch(
      items.map((item: { product_id?: number; description?: string; quantity: number; unit_price: number }) => ({
        sql: `INSERT INTO credit_note_items (credit_note_id, product_id, description, quantity, unit_price, total_price)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          creditNoteId,
          item.product_id || null,
          item.description || null,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price,
        ],
      })),
      "write"
    );

    return NextResponse.json({ id: creditNoteId, credit_note_no: creditNoteNo }, { status: 201 });
  } catch (err: any) {
    console.error("[API /credit-notes POST]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
