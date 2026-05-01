import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.*, c.name as customer_name, c.location as customer_location,
            c.is_export, c.charges_efd, c.efd_profit_per_carton,
            u.full_name as user_name
     FROM requests r
     JOIN customers c ON r.customer_id = c.id
     JOIN users u ON r.user_id = u.id
     WHERE r.id = ?`,
    [params.id]
  );

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [items] = await pool.execute<RowDataPacket[]>(
    `SELECT ri.*, p.name as product_name, p.carton_weight
     FROM request_items ri
     JOIN products p ON ri.product_id = p.id
     WHERE ri.request_id = ?`,
    [params.id]
  );

  const [signatures] = await pool.execute<RowDataPacket[]>(
    `SELECT rs.*, u.full_name as user_name
     FROM request_signatures rs
     JOIN users u ON rs.user_id = u.id
     WHERE rs.request_id = ?
     ORDER BY rs.signed_at ASC`,
    [params.id]
  );

  return NextResponse.json({ ...rows[0], items, signatures });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { truck_number, driver_name, route, status, items } = body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const updates: string[] = [];
    const vals: (string | number)[] = [];

    if (truck_number !== undefined) { updates.push("truck_number = ?"); vals.push(truck_number); }
    if (driver_name !== undefined) { updates.push("driver_name = ?"); vals.push(driver_name); }
    if (route !== undefined) { updates.push("route = ?"); vals.push(route); }
    if (status !== undefined) { updates.push("status = ?"); vals.push(status); }

    if (updates.length) {
      await conn.execute(
        `UPDATE requests SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`,
        [...vals, params.id]
      );
    }

    if (items) {
      await conn.execute("DELETE FROM request_items WHERE request_id = ?", [params.id]);
      for (const item of items) {
        await conn.execute(
          `INSERT INTO request_items (request_id, product_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [params.id, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price]
        );
      }
    }

    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  } finally {
    conn.release();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM request_signatures WHERE request_id = ?", [params.id]);
    await conn.execute("DELETE FROM request_items WHERE request_id = ?", [params.id]);
    await conn.execute("DELETE FROM requests WHERE id = ?", [params.id]);
    await conn.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await conn.rollback();
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  } finally {
    conn.release();
  }
}
