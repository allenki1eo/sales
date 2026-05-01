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
  const all = searchParams.get("all") === "true";
  const offset = (page - 1) * limit;

  if (all) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, name, location, phone, is_export, charges_efd, efd_profit_per_carton
       FROM customers ORDER BY name ASC`
    );
    return NextResponse.json(rows);
  }

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];

  if (search) {
    where += " AND (name LIKE ? OR location LIKE ? OR phone LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [countRows] = await pool.execute<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM customers ${where}`,
    params
  );
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT * FROM customers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return NextResponse.json({
    data: rows,
    total: countRows[0].total,
    page,
    limit,
    totalPages: Math.ceil(countRows[0].total / limit),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, location, phone, is_export, charges_efd, efd_profit_per_carton } = body;

  if (!name || !location) {
    return NextResponse.json({ error: "Name and location are required" }, { status: 400 });
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO customers (name, location, phone, is_export, charges_efd, efd_profit_per_carton)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, location, phone || null, is_export ? 1 : 0, charges_efd ? 1 : 0, efd_profit_per_carton || 0]
  );

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}
