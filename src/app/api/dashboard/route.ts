import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

    const [
      pending, approved, customers, products,
      totalRevenue, monthlyRevenue, monthlyCartons,
      trend, topProducts, topCustomers, recent,
      exportVsLocal, topRoutes,
    ] = await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM requests WHERE status = 'pending'"),
      db.execute("SELECT COUNT(*) as count FROM requests WHERE status = 'approved'"),
      db.execute("SELECT COUNT(*) as count FROM customers"),
      db.execute("SELECT COUNT(*) as count FROM products"),

      db.execute(`
        SELECT COALESCE(SUM(ri.total_price), 0) as total
        FROM request_items ri
        JOIN requests r ON ri.request_id = r.id
        WHERE r.status IN ('approved','dispatched')`),

      db.execute({
        sql: `SELECT COALESCE(SUM(ri.total_price), 0) as total
              FROM request_items ri
              JOIN requests r ON ri.request_id = r.id
              WHERE r.status IN ('approved','dispatched')
              AND strftime('%Y-%m', r.created_at) = ?`,
        args: [month],
      }),

      db.execute({
        sql: `SELECT COALESCE(SUM(ri.quantity), 0) as total
              FROM request_items ri
              JOIN requests r ON ri.request_id = r.id
              WHERE r.status IN ('approved','dispatched')
              AND strftime('%Y-%m', r.created_at) = ?`,
        args: [month],
      }),

      db.execute(`
        SELECT strftime('%Y-%m', r.created_at) as month,
               COALESCE(SUM(ri.total_price), 0) as revenue,
               COALESCE(SUM(ri.quantity), 0) as cartons
        FROM requests r
        LEFT JOIN request_items ri ON ri.request_id = r.id
        WHERE r.status IN ('approved','dispatched')
          AND r.created_at >= datetime('now', '-6 months')
        GROUP BY strftime('%Y-%m', r.created_at)
        ORDER BY month ASC`),

      db.execute(`
        SELECT p.id as product_id, p.name as product_name,
               COALESCE(SUM(ri.total_price), 0) as total_revenue,
               COALESCE(SUM(ri.quantity), 0) as total_cartons
        FROM products p
        LEFT JOIN request_items ri ON ri.product_id = p.id
        LEFT JOIN requests r ON ri.request_id = r.id AND r.status IN ('approved','dispatched')
        GROUP BY p.id, p.name
        ORDER BY total_revenue DESC
        LIMIT 5`),

      db.execute(`
        SELECT c.id as customer_id, c.name as customer_name,
               COALESCE(SUM(ri.total_price), 0) as total_revenue,
               COUNT(DISTINCT r.id) as total_orders
        FROM customers c
        LEFT JOIN requests r ON r.customer_id = c.id AND r.status IN ('approved','dispatched')
        LEFT JOIN request_items ri ON ri.request_id = r.id
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
        LIMIT 5`),

      db.execute(`
        SELECT r.id, r.status, r.truck_no AS truck_number, r.route, r.created_at,
               c.name as customer_name, u.full_name as user_name
        FROM requests r
        JOIN customers c ON r.customer_id = c.id
        JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
        LIMIT 10`),

      db.execute(`
        SELECT c.is_export,
               COALESCE(SUM(ri.total_price), 0) as revenue,
               COALESCE(SUM(ri.quantity), 0) as cartons,
               COUNT(DISTINCT r.id) as orders
        FROM requests r
        JOIN customers c ON r.customer_id = c.id
        JOIN request_items ri ON ri.request_id = r.id
        WHERE r.status IN ('approved','dispatched')
        GROUP BY c.is_export`),

      db.execute(`
        SELECT r.route,
               COALESCE(SUM(ri.quantity), 0) as cartons,
               COALESCE(SUM(ri.total_price), 0) as revenue,
               COUNT(DISTINCT r.id) as orders
        FROM requests r
        JOIN request_items ri ON ri.request_id = r.id
        WHERE r.status IN ('approved','dispatched')
          AND r.route != ''
        GROUP BY r.route
        ORDER BY cartons DESC
        LIMIT 8`),
    ]);

    return NextResponse.json({
      stats: {
        pending_requests:  Number(pending.rows[0].count) || 0,
        approved_requests: Number(approved.rows[0].count) || 0,
        total_customers:   Number(customers.rows[0].count) || 0,
        total_products:    Number(products.rows[0].count) || 0,
        total_revenue:     Number(totalRevenue.rows[0].total) || 0,
        monthly_revenue:   Number(monthlyRevenue.rows[0].total) || 0,
        monthly_cartons:   Number(monthlyCartons.rows[0].total) || 0,
      },
      trend:          trend.rows,
      topProducts:    topProducts.rows,
      topCustomers:   topCustomers.rows,
      recentRequests: recent.rows,
      exportVsLocal:  exportVsLocal.rows,
      topRoutes:      topRoutes.rows,
    });
  } catch (err: any) {
    console.error("[API /dashboard GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
