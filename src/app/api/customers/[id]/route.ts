import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { sendImsEvent } from "@/lib/ims-webhook";
import { ensureFinanceTables } from "@/lib/finance-schema";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureFinanceTables();
    const result = await db.execute({ sql: "SELECT * FROM customers WHERE id = ?", args: [params.id] });
    if (!result.rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    console.error("[API /customers/:id GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, location, phone, is_export, charges_efd, efd_profit_per_carton,
          opening_balance, opening_balance_date } = body;

  await db.execute({
    sql: `UPDATE customers SET name=?, location=?, phone=?, is_export=?, charges_efd=?, efd_profit_per_carton=?
          WHERE id = ?`,
    args: [name, location, phone || "", is_export ? 1 : 0, charges_efd ? 1 : 0, efd_profit_per_carton || 0, params.id],
  });

  // Opening balance (pre-system debt) is money — only admins/accountants may set it
  if (opening_balance !== undefined && ["admin", "accountant"].includes(session.user.role)) {
    await ensureFinanceTables();
    const date = opening_balance_date && /^\d{4}-\d{2}-\d{2}$/.test(opening_balance_date)
      ? opening_balance_date
      : new Date().toISOString().slice(0, 10);
    await db.execute({
      sql: "UPDATE customers SET opening_balance = ?, opening_balance_date = ? WHERE id = ?",
      args: [Math.max(Number(opening_balance) || 0, 0), date, params.id],
    });
  }

  void sendImsEvent("customer.updated", {
    id: String(params.id),
    code: `CUST-${String(params.id).padStart(3, "0")}`,
    name,
    email: null,
    phone: phone || null,
    address: location || null,
    contactPerson: null,
    creditLimit: 0,
    currency: "TZS",
    status: "ACTIVE",
    notes: null,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.execute({ sql: "DELETE FROM customers WHERE id = ?", args: [params.id] });
  return NextResponse.json({ success: true });
}
