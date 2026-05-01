import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (search) {
    where += " AND (c.name LIKE ? OR r.truck_number LIKE ? OR r.route LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (status) {
    where += " AND r.status = ?";
    params.push(status);
  }

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM requests r JOIN customers c ON r.customer_id = c.id ${where}`,
    params
  );

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.status, r.truck_number, r.driver_name, r.route,
            r.vat_percentage, r.created_at, r.updated_at,
            c.name as customer_name, c.location as customer_location,
            u.full_name as user_name
     FROM requests r
     JOIN customers c ON r.customer_id = c.id
     JOIN users u ON r.user_id = u.id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const total = countRows[0].total;

  return NextResponse.json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { customer_id, truck_number, driver_name, route, items } = body;

  if (!customer_id || !truck_number || !driver_name || !route || !items?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO requests (customer_id, user_id, truck_number, driver_name, route, vat_percentage, status)
       VALUES (?, ?, ?, ?, ?, 18, 'pending')`,
      [customer_id, parseInt(session.user.id), truck_number, driver_name, route]
    );
    const requestId = result.insertId;

    for (const item of items) {
      await conn.execute(
        `INSERT INTO request_items (request_id, product_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`,
        [requestId, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    await conn.execute(
      `INSERT INTO request_signatures (request_id, signature_type, user_id, signed_at)
       VALUES (?, 'prepared_by', ?, NOW())`,
      [requestId, session.user.id]
    );

    await conn.commit();
    return NextResponse.json({ id: requestId }, { status: 201 });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  } finally {
    conn.release();
  }
}
