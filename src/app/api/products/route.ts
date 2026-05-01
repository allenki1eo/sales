import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM products ORDER BY name ASC"
  );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, default_price, carton_weight } = body;

  if (!name || default_price === undefined) {
    return NextResponse.json({ error: "Name and price are required" }, { status: 400 });
  }

  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO products (name, default_price, carton_weight) VALUES (?, ?, ?)",
    [name, default_price, carton_weight || 0]
  );

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}
