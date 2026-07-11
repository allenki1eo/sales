import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { ensureFinanceTables, CUSTOMER_INVOICES_SQL } from "@/lib/finance-schema";

// FIFO payment allocation: the pool of money received (payments + approved
// credit notes) settles the opening balance first, then invoices oldest-first.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureFinanceTables();

    const customerId = parseInt(params.id);

    const customerResult = await db.execute({
      sql: `SELECT id, name, location, opening_balance, opening_balance_date
            FROM customers WHERE id = ?`,
      args: [customerId],
    });
    if (!customerResult.rows.length) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const customer = customerResult.rows[0];

    const [invoices, paymentsTotal, creditsTotal] = await Promise.all([
      db.execute({
        sql: `${CUSTOMER_INVOICES_SQL} ORDER BY doc_date ASC, r.id ASC`,
        args: [customerId],
      }),
      db.execute({
        sql: "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE customer_id = ?",
        args: [customerId],
      }),
      db.execute({
        sql: `SELECT COALESCE(SUM(cni.total_price), 0) as total
              FROM credit_note_items cni
              JOIN credit_notes cn ON cni.credit_note_id = cn.id
              WHERE cn.customer_id = ? AND cn.status = 'approved'`,
        args: [customerId],
      }),
    ]);

    interface Debit {
      type: "opening_balance" | "invoice";
      id: number | null;
      ref: string;
      date: string;
      description: string;
      amount: number;
      cartons: number;
    }

    const debits: Debit[] = [];

    const openingBalance = Number(customer.opening_balance) || 0;
    if (openingBalance > 0) {
      debits.push({
        type: "opening_balance",
        id: null,
        ref: "OPENING",
        date: String(customer.opening_balance_date || ""),
        description: "Opening balance brought forward",
        amount: openingBalance,
        cartons: 0,
      });
    }

    for (const r of invoices.rows) {
      debits.push({
        type: "invoice",
        id: Number(r.id),
        ref: `INV-${r.id}`,
        date: String(r.doc_date),
        description: `${r.route || "Sale"}${r.truck_no ? ` (${r.truck_no})` : ""}`,
        amount: Number(r.amount) || 0,
        cartons: Number(r.cartons) || 0,
      });
    }

    const totalCredits =
      (Number(paymentsTotal.rows[0].total) || 0) +
      (Number(creditsTotal.rows[0].total) || 0);

    // Walk oldest-first, draining the credit pool
    let pool = totalCredits;
    const lines = debits.map((d) => {
      const paid = Math.min(pool, d.amount);
      pool -= paid;
      const fullyPaid = d.amount - paid < 0.005;
      const cartonsPaid = fullyPaid
        ? d.cartons
        : d.amount > 0
          ? Math.floor(d.cartons * (paid / d.amount))
          : 0;
      return {
        ...d,
        paid_amount: paid,
        outstanding: d.amount - paid,
        cartons_paid: cartonsPaid,
        cartons_pending: d.cartons - cartonsPaid,
        status: fullyPaid ? "paid" : paid > 0 ? "partial" : "unpaid",
      };
    });

    const totalInvoiced = debits.reduce((s, d) => s + d.amount, 0);
    const totalCartons = debits.reduce((s, d) => s + d.cartons, 0);
    const cartonsPaid = lines.reduce((s, l) => s + l.cartons_paid, 0);

    return NextResponse.json({
      customer: { id: customer.id, name: customer.name, location: customer.location },
      opening_balance: openingBalance,
      total_invoiced: totalInvoiced,
      total_credits: totalCredits,
      total_outstanding: Math.max(totalInvoiced - totalCredits, 0),
      unallocated_credit: pool, // advance payment beyond all invoices
      total_cartons: totalCartons,
      cartons_paid: cartonsPaid,
      cartons_pending: totalCartons - cartonsPaid,
      lines,
    });
  } catch (err: any) {
    console.error("[API /customers/[id]/allocation GET]", err);
    return NextResponse.json({ error: err.message || "Database error" }, { status: 500 });
  }
}
