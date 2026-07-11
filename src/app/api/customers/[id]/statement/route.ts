import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { ensureFinanceTables } from "@/lib/finance-schema";

// Invoice value matches the request document: gross item total plus the EFD
// charge for customers that carry it (prices are stored VAT-inclusive for
// local customers, VAT-free for export customers).
const INVOICE_SQL = `
  SELECT r.id,
         COALESCE(r.request_date, date(r.created_at)) as doc_date,
         COALESCE(SUM(ri.total_price), 0)
           + CASE WHEN c.charges_efd = 1
                  THEN COALESCE(SUM(ri.quantity), 0) * c.efd_profit_per_carton
                  ELSE 0 END as amount,
         r.truck_no, r.route
  FROM requests r
  JOIN customers c ON r.customer_id = c.id
  LEFT JOIN request_items ri ON ri.request_id = r.id
  WHERE r.customer_id = ? AND r.status IN ('approved','dispatched')
  GROUP BY r.id`;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureFinanceTables();

    const customerId = parseInt(params.id);
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "";
    const to   = searchParams.get("to")   || "";

    const customerResult = await db.execute({
      sql: "SELECT id, name, location, phone, is_export FROM customers WHERE id = ?",
      args: [customerId],
    });
    if (!customerResult.rows.length) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const [invoices, creditNotes, payments] = await Promise.all([
      db.execute({ sql: INVOICE_SQL, args: [customerId] }),
      db.execute({
        sql: `SELECT cn.id, cn.credit_note_no, cn.credit_date as doc_date, cn.reason,
                     COALESCE(SUM(cni.total_price), 0) as amount
              FROM credit_notes cn
              LEFT JOIN credit_note_items cni ON cni.credit_note_id = cn.id
              WHERE cn.customer_id = ? AND cn.status = 'approved'
              GROUP BY cn.id`,
        args: [customerId],
      }),
      db.execute({
        sql: `SELECT id, payment_date as doc_date, amount, method, reference
              FROM payments WHERE customer_id = ?`,
        args: [customerId],
      }),
    ]);

    interface Line {
      date: string;
      type: "invoice" | "credit_note" | "payment";
      ref: string;
      description: string;
      debit: number;
      credit: number;
      link?: string;
    }

    const methodLabels: Record<string, string> = {
      cash: "Cash", bank: "Bank", mobile_money: "Mobile Money", cheque: "Cheque", other: "Other",
    };

    const allLines: Line[] = [
      ...invoices.rows.map((r) => ({
        date: String(r.doc_date),
        type: "invoice" as const,
        ref: `INV-${r.id}`,
        description: `Sales invoice${r.route ? ` — ${r.route}` : ""}${r.truck_no ? ` (${r.truck_no})` : ""}`,
        debit: Number(r.amount) || 0,
        credit: 0,
        link: `/requests/${r.id}`,
      })),
      ...creditNotes.rows.map((r) => ({
        date: String(r.doc_date),
        type: "credit_note" as const,
        ref: String(r.credit_note_no),
        description: `Credit note — ${r.reason}`,
        debit: 0,
        credit: Number(r.amount) || 0,
        link: `/credit-notes/${r.id}`,
      })),
      ...payments.rows.map((r) => ({
        date: String(r.doc_date),
        type: "payment" as const,
        ref: r.reference ? String(r.reference) : `PAY-${r.id}`,
        description: `Payment received — ${methodLabels[String(r.method)] || r.method}`,
        debit: 0,
        credit: Number(r.amount) || 0,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date) || a.ref.localeCompare(b.ref));

    const before = from ? allLines.filter((l) => l.date < from) : [];
    const lines = allLines.filter(
      (l) => (!from || l.date >= from) && (!to || l.date <= to)
    );

    const openingBalance = before.reduce((s, l) => s + l.debit - l.credit, 0);
    const totalDebits  = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = lines.reduce((s, l) => s + l.credit, 0);

    return NextResponse.json({
      customer: customerResult.rows[0],
      from: from || null,
      to: to || null,
      opening_balance: openingBalance,
      lines,
      total_debits: totalDebits,
      total_credits: totalCredits,
      closing_balance: openingBalance + totalDebits - totalCredits,
    });
  } catch (err: any) {
    console.error("[API /customers/[id]/statement GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
