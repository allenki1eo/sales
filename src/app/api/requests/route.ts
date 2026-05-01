import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const page   = parseInt(searchParams.get("page")  || "1");
    const limit  = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    let where = "WHERE 1=1";
    const args: (string | number)[] = [];

    if (search) {
      where += " AND (c.name LIKE ? OR r.truck_number LIKE ? OR r.route LIKE ?)";
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (status) {
      where += " AND r.status = ?";
      args.push(status);
    }

    const countResult = await db.execute({
      sql: `SELECT COUNT(*) as total FROM requests r JOIN customers c ON r.customer_id = c.id ${where}`,
      args,
    });

    const rows = await db.execute({
      sql: `SELECT r.id, r.status, r.truck_number, r.driver_name, r.route,
                   r.vat_percentage, r.created_at, r.updated_at,
                   c.name as customer_name, c.location as customer_location,
                   u.full_name as user_name
            FROM requests r
            JOIN customers c ON r.customer_id = c.id
            JOIN users u ON r.user_id = u.id
            ${where}
            ORDER BY r.created_at DESC
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
    console.error("[API /requests GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { customer_id, truck_number, driver_name, route, items } = body;

  if (!customer_id || !truck_number || !driver_name || !route || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const insertRequest = await db.execute({
    sql: `INSERT INTO requests (customer_id, user_id, truck_number, driver_name, route, vat_percentage, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 18, 'pending', ?, ?)`,
    args: [customer_id, parseInt(session.user.id), truck_number, driver_name, route, now, now],
  });

  const requestId = Number(insertRequest.lastInsertRowid);

  const stmts = [
    ...items.map((item: { product_id: number; quantity: number; unit_price: number }) => ({
      sql: `INSERT INTO request_items (request_id, product_id, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?)`,
      args: [requestId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price],
    })),
    {
      sql: `INSERT INTO request_signatures (request_id, user_id, signature_type, signed_at)
            VALUES (?, ?, 'prepared_by', ?)`,
      args: [requestId, session.user.id, now],
    },
  ];

  await db.batch(stmts, "write");

  return NextResponse.json({ id: requestId }, { status: 201 });
}
