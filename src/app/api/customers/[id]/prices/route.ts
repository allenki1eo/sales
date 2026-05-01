import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT p.id as product_id, p.name as product_name, p.default_price,
            COALESCE(cp.price, p.default_price) as price,
            cp.id
     FROM products p
     LEFT JOIN customer_prices cp ON cp.product_id = p.id AND cp.customer_id = ?
     ORDER BY p.name ASC`,
    [params.id]
  );

  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { product_id, price } = body;

  if (!product_id || price === undefined) {
    return NextResponse.json({ error: "product_id and price are required" }, { status: 400 });
  }

  // Check if default price equals provided price → delete custom price
  const [productRows] = await pool.execute<RowDataPacket[]>(
    "SELECT default_price FROM products WHERE id = ?",
    [product_id]
  );

  if (!productRows.length) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  if (parseFloat(price) === parseFloat(productRows[0].default_price)) {
    await pool.execute(
      "DELETE FROM customer_prices WHERE customer_id = ? AND product_id = ?",
      [params.id, product_id]
    );
  } else {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO customer_prices (customer_id, product_id, price)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE price = VALUES(price)`,
      [params.id, product_id, price]
    );
  }

  return NextResponse.json({ success: true });
}
