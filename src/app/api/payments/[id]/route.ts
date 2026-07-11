import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { ensureFinanceTables } from "@/lib/finance-schema";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can delete payments" }, { status: 403 });
  }

  try {
    await ensureFinanceTables();

    const result = await db.execute({
      sql: "DELETE FROM payments WHERE id = ?",
      args: [parseInt(params.id)],
    });

    if (!result.rowsAffected) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /payments/[id] DELETE]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
