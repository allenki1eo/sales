import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { sendImsEvent } from "@/lib/ims-webhook";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const all    = searchParams.get("all") === "true";
  const page   = parseInt(searchParams.get("page")  || "1");
  const limit  = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const offset = (page - 1) * limit;

  if (all) {
    const result = await db.execute(
      "SELECT id, name, location, phone, is_export, charges_efd, efd_profit_per_carton FROM customers ORDER BY name ASC"
    );
    return NextResponse.json(result.rows);
  }

  let where = "WHERE 1=1";
  const args: (string | number)[] = [];

  if (search) {
    where += " AND (name LIKE ? OR location LIKE ? OR phone LIKE ?)";
    args.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = await db.execute({ sql: `SELECT COUNT(*) as total FROM customers ${where}`, args });
  const rows        = await db.execute({ sql: `SELECT * FROM customers ${where} ORDER BY name ASC LIMIT ? OFFSET ?`, args: [...args, limit, offset] });

  const total = countResult.rows[0].total as number;

  return NextResponse.json({
    data: rows.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
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

  const result = await db.execute({
    sql: `INSERT INTO customers (name, location, phone, is_export, charges_efd, efd_profit_per_carton)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [name, location, phone || "", is_export ? 1 : 0, charges_efd ? 1 : 0, efd_profit_per_carton || 0],
  });

  const id = Number(result.lastInsertRowid);

  void sendImsEvent("customer.created", {
    id: String(id),
    code: `CUST-${String(id).padStart(3, "0")}`,
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

  return NextResponse.json({ id }, { status: 201 });
}
