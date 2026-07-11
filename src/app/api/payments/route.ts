import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { ensureFinanceTables } from "@/lib/finance-schema";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureFinanceTables();

    const { searchParams } = new URL(req.url);
    const page       = parseInt(searchParams.get("page")  || "1");
    const limit      = parseInt(searchParams.get("limit") || "10");
    const search     = searchParams.get("search") || "";
    const customerId = searchParams.get("customer_id") || "";
    const from       = searchParams.get("from") || "";
    const to         = searchParams.get("to")   || "";
    const offset     = (page - 1) * limit;

    let where = "WHERE 1=1";
    const args: (string | number)[] = [];

    if (search) {
      where += " AND (c.name LIKE ? OR p.reference LIKE ?)";
      args.push(`%${search}%`, `%${search}%`);
    }
    if (customerId) {
      where += " AND p.customer_id = ?";
      args.push(parseInt(customerId));
    }
    if (from) {
      where += " AND p.payment_date >= ?";
      args.push(from);
    }
    if (to) {
      where += " AND p.payment_date <= ?";
      args.push(to);
    }

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM payments p JOIN customers c ON p.customer_id = c.id ${where}`,
      args,
    });

    const rows = await db.execute({
      sql: `SELECT p.id, p.customer_id, p.amount, p.payment_date, p.method,
                   p.reference, p.notes, p.created_at,
                   c.name as customer_name, u.full_name as user_name
            FROM payments p
            JOIN customers c ON p.customer_id = c.id
            JOIN users u ON p.user_id = u.id
            ${where}
            ORDER BY p.payment_date DESC, p.id DESC
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
    console.error("[API /payments GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "accountant"].includes(session.user.role)) {
    return NextResponse.json({ error: "Only admins and accountants can record payments" }, { status: 403 });
  }

  try {
    await ensureFinanceTables();

    const body = await req.json();
    const { customer_id, amount, payment_date, method, reference, notes } = body;

    if (!customer_id || !(Number(amount) > 0)) {
      return NextResponse.json({ error: "Customer and a positive amount are required" }, { status: 400 });
    }

    const validMethods = ["cash", "bank", "mobile_money", "cheque", "other"];
    const payMethod = validMethods.includes(method) ? method : "cash";

    const date = payment_date && /^\d{4}-\d{2}-\d{2}$/.test(payment_date)
      ? payment_date
      : new Date().toISOString().slice(0, 10);

    const result = await db.execute({
      sql: `INSERT INTO payments (customer_id, user_id, amount, payment_date, method, reference, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [customer_id, parseInt(session.user.id), Number(amount), date, payMethod, reference || null, notes || null],
    });

    return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
  } catch (err: any) {
    console.error("[API /payments POST]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
