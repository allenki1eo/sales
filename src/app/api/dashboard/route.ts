import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [year, monthNum] = month.split("-");

  const [pendingRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM requests WHERE status = 'pending'"
  );
  const [approvedRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM requests WHERE status = 'approved'"
  );
  const [customerRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM customers"
  );
  const [productRows] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM products"
  );
  const [totalRevenueRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(ri.total_price), 0) as total
     FROM request_items ri
     JOIN requests r ON ri.request_id = r.id
     WHERE r.status IN ('approved', 'dispatched')`
  );
  const [monthlyRevenueRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(ri.total_price), 0) as total
     FROM request_items ri
     JOIN requests r ON ri.request_id = r.id
     WHERE r.status IN ('approved', 'dispatched')
     AND YEAR(r.created_at) = ? AND MONTH(r.created_at) = ?`,
    [year, monthNum]
  );
  const [monthlyCartonsRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COALESCE(SUM(ri.quantity), 0) as total
     FROM request_items ri
     JOIN requests r ON ri.request_id = r.id
     WHERE r.status IN ('approved', 'dispatched')
     AND YEAR(r.created_at) = ? AND MONTH(r.created_at) = ?`,
    [year, monthNum]
  );

  // 6-month trend
  const [trendRows] = await pool.execute<RowDataPacket[]>(
    `SELECT DATE_FORMAT(r.created_at, '%Y-%m') as month,
            COALESCE(SUM(ri.total_price), 0) as revenue,
            COALESCE(SUM(ri.quantity), 0) as cartons
     FROM requests r
     LEFT JOIN request_items ri ON ri.request_id = r.id
     WHERE r.status IN ('approved', 'dispatched')
     AND r.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
     GROUP BY DATE_FORMAT(r.created_at, '%Y-%m')
     ORDER BY month ASC`
  );

  // Top products
  const [topProductsRows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id as product_id, p.name as product_name,
            COALESCE(SUM(ri.total_price), 0) as total_revenue,
            COALESCE(SUM(ri.quantity), 0) as total_cartons
     FROM products p
     LEFT JOIN request_items ri ON ri.product_id = p.id
     LEFT JOIN requests r ON ri.request_id = r.id AND r.status IN ('approved', 'dispatched')
     GROUP BY p.id, p.name
     ORDER BY total_revenue DESC
     LIMIT 5`
  );

  // Top customers
  const [topCustomersRows] = await pool.execute<RowDataPacket[]>(
    `SELECT c.id as customer_id, c.name as customer_name,
            COALESCE(SUM(ri.total_price), 0) as total_revenue,
            COUNT(DISTINCT r.id) as total_orders
     FROM customers c
     LEFT JOIN requests r ON r.customer_id = c.id AND r.status IN ('approved', 'dispatched')
     LEFT JOIN request_items ri ON ri.request_id = r.id
     GROUP BY c.id, c.name
     ORDER BY total_revenue DESC
     LIMIT 5`
  );

  // Recent requests
  const [recentRows] = await pool.execute<RowDataPacket[]>(
    `SELECT r.id, r.status, r.truck_number, r.route, r.created_at,
            c.name as customer_name,
            u.full_name as user_name
     FROM requests r
     JOIN customers c ON r.customer_id = c.id
     JOIN users u ON r.user_id = u.id
     ORDER BY r.created_at DESC
     LIMIT 10`
  );

  return NextResponse.json({
    stats: {
      pending_requests: pendingRows[0].count,
      approved_requests: approvedRows[0].count,
      total_customers: customerRows[0].count,
      total_products: productRows[0].count,
      total_revenue: totalRevenueRows[0].total,
      monthly_revenue: monthlyRevenueRows[0].total,
      monthly_cartons: monthlyCartonsRows[0].total,
    },
    trend: trendRows,
    topProducts: topProductsRows,
    topCustomers: topCustomersRows,
    recentRequests: recentRows,
  });
}
