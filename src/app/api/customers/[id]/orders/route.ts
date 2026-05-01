import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await db.execute({
      sql: `SELECT
              r.id,
              r.status,
              r.truck_no  AS truck_number,
              r.driver_name,
              r.route,
              r.request_date,
              r.created_at,
              strftime('%Y-%m', r.created_at) AS month,
              COALESCE(SUM(ri.total_price), 0) AS total_value,
              COALESCE(SUM(ri.quantity), 0)    AS total_cartons
            FROM requests r
            LEFT JOIN request_items ri ON ri.request_id = r.id
            WHERE r.customer_id = ?
            GROUP BY r.id
            ORDER BY r.created_at DESC`,
      args: [params.id],
    });

    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error("[API /customers/:id/orders GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
