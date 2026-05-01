import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.execute("SELECT * FROM products ORDER BY name ASC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, default_price, carton_weight } = body;

  if (!name || default_price === undefined) {
    return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
  }

  const result = await db.execute({
    sql: "INSERT INTO products (name, default_price, carton_weight) VALUES (?, ?, ?)",
    args: [name, default_price, carton_weight || 0],
  });

  return NextResponse.json({ id: Number(result.lastInsertRowid) }, { status: 201 });
}
