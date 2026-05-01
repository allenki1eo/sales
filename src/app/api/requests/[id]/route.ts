import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [reqResult, itemsResult, sigsResult] = await Promise.all([
      db.execute({
        sql: `SELECT r.*, c.name as customer_name, c.location as customer_location,
                     c.is_export, c.charges_efd, c.efd_profit_per_carton,
                     u.full_name as user_name
              FROM requests r
              JOIN customers c ON r.customer_id = c.id
              JOIN users u ON r.user_id = u.id
              WHERE r.id = ?`,
        args: [params.id],
      }),
      db.execute({
        sql: `SELECT ri.*, p.name as product_name, p.carton_weight
              FROM request_items ri
              JOIN products p ON ri.product_id = p.id
              WHERE ri.request_id = ?`,
        args: [params.id],
      }),
      db.execute({
        sql: `SELECT rs.*, u.full_name as user_name
              FROM request_signatures rs
              JOIN users u ON rs.user_id = u.id
              WHERE rs.request_id = ?
              ORDER BY rs.signed_at ASC`,
        args: [params.id],
      }),
    ]);

    if (!reqResult.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      ...reqResult.rows[0],
      items:      itemsResult.rows,
      signatures: sigsResult.rows,
    });
  } catch (err: any) {
    console.error("[API /requests/:id GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { truck_number, driver_name, route, status, items } = body;
  const now = new Date().toISOString();

  const setClauses: string[] = ["updated_at = ?"];
  const vals: (string | number)[] = [now];

  if (truck_number !== undefined) { setClauses.push("truck_number = ?"); vals.push(truck_number); }
  if (driver_name  !== undefined) { setClauses.push("driver_name = ?");  vals.push(driver_name); }
  if (route        !== undefined) { setClauses.push("route = ?");         vals.push(route); }
  if (status       !== undefined) { setClauses.push("status = ?");        vals.push(status); }

  const stmts: { sql: string; args: (string | number)[] }[] = [
    { sql: `UPDATE requests SET ${setClauses.join(", ")} WHERE id = ?`, args: [...vals, params.id] },
  ];

  if (items) {
    stmts.push({ sql: "DELETE FROM request_items WHERE request_id = ?", args: [params.id] });
    for (const item of items as { product_id: number; quantity: number; unit_price: number }[]) {
      stmts.push({
        sql: `INSERT INTO request_items (request_id, product_id, quantity, unit_price, total_price)
              VALUES (?, ?, ?, ?, ?)`,
        args: [params.id, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price],
      });
    }
  }

  await db.batch(stmts, "write");
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.batch([
    { sql: "DELETE FROM request_signatures WHERE request_id = ?", args: [params.id] },
    { sql: "DELETE FROM request_items WHERE request_id = ?",      args: [params.id] },
    { sql: "DELETE FROM requests WHERE id = ?",                   args: [params.id] },
  ], "write");

  return NextResponse.json({ success: true });
}
