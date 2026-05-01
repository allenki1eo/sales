import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket } from "mysql2";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT * FROM customers WHERE id = ?",
    [params.id]
  );

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, location, phone, is_export, charges_efd, efd_profit_per_carton } = body;

  await pool.execute(
    `UPDATE customers SET name=?, location=?, phone=?, is_export=?, charges_efd=?, efd_profit_per_carton=?
     WHERE id = ?`,
    [name, location, phone || null, is_export ? 1 : 0, charges_efd ? 1 : 0, efd_profit_per_carton || 0, params.id]
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await pool.execute("DELETE FROM customers WHERE id = ?", [params.id]);
  return NextResponse.json({ success: true });
}
