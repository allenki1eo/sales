import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.execute({
    sql: `SELECT p.id as product_id, p.name as product_name, p.default_price,
                 COALESCE(cp.price, p.default_price) as price
          FROM products p
          LEFT JOIN customer_prices cp ON cp.product_id = p.id AND cp.customer_id = ?
          ORDER BY p.name ASC`,
    args: [params.id],
  });

  return NextResponse.json(result.rows);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { product_id, price } = body;

  if (!product_id || price === undefined) {
    return NextResponse.json({ error: "product_id and price are required" }, { status: 400 });
  }

  const productResult = await db.execute({
    sql: "SELECT default_price FROM products WHERE id = ?",
    args: [product_id],
  });
  if (!productResult.rows.length) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  const defaultPrice = productResult.rows[0].default_price as number;

  if (parseFloat(String(price)) === parseFloat(String(defaultPrice))) {
    // Reset to default — remove custom price
    await db.execute({
      sql: "DELETE FROM customer_prices WHERE customer_id = ? AND product_id = ?",
      args: [params.id, product_id],
    });
  } else {
    // Upsert custom price
    await db.execute({
      sql: `INSERT INTO customer_prices (customer_id, product_id, price) VALUES (?, ?, ?)
            ON CONFLICT (customer_id, product_id) DO UPDATE SET price = excluded.price`,
      args: [params.id, product_id, price],
    });
  }

  return NextResponse.json({ success: true });
}
