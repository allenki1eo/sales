import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, default_price, carton_weight } = body;

  await pool.execute(
    "UPDATE products SET name=?, default_price=?, carton_weight=? WHERE id=?",
    [name, default_price, carton_weight || 0, params.id]
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await pool.execute("DELETE FROM products WHERE id = ?", [params.id]);
  return NextResponse.json({ success: true });
}
