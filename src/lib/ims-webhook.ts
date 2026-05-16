import crypto from "crypto";
import db from "@/lib/db";

const WEBHOOK_PATH = "/api/webhooks/sales";

const STATUS_MAP: Record<string, string> = {
  pending: "PENDING",
  approved: "CONFIRMED",
  dispatched: "DISPATCHED",
  rejected: "CANCELLED",
};

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function sendImsEvent(event: string, data: unknown): Promise<void> {
  const baseUrl = process.env.IMS_BASE_URL;
  const secret = process.env.SALES_WEBHOOK_SECRET;

  if (!baseUrl || !secret) {
    console.warn("[IMS] IMS_BASE_URL or SALES_WEBHOOK_SECRET not configured — skipping webhook");
    return;
  }

  const body = JSON.stringify({ event, data });
  const sig =
    "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const res = await fetch(`${baseUrl}${WEBHOOK_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sales-signature": sig },
        body,
      });

      if (res.ok) {
        console.log(`[IMS] ${event} → ${res.status}`);
        return;
      }

      if (res.status >= 400 && res.status < 500) {
        console.error(`[IMS] ${event} rejected with ${res.status} — not retrying`);
        return;
      }

      console.warn(
        `[IMS] ${event} server error ${res.status}, attempt ${attempt + 1}/${delays.length + 1}`
      );
    } catch (err) {
      console.warn(
        `[IMS] ${event} network error, attempt ${attempt + 1}/${delays.length + 1}:`,
        err
      );
    }

    if (attempt < delays.length) await sleep(delays[attempt]);
  }

  console.error(`[IMS] ${event} failed after ${delays.length + 1} attempts`);
}

async function fetchOrderPayload(requestId: number | string) {
  const [reqResult, itemsResult] = await Promise.all([
    db.execute({
      sql: `SELECT r.id, r.customer_id, r.status, r.request_date,
                   r.vat_percent, r.created_at,
                   c.name AS customer_name, c.phone AS customer_phone
            FROM requests r
            JOIN customers c ON r.customer_id = c.id
            WHERE r.id = ?`,
      args: [requestId],
    }),
    db.execute({
      sql: `SELECT ri.id, ri.quantity, ri.unit_price, ri.total_price,
                   p.id AS product_id, p.name AS product_name
            FROM request_items ri
            JOIN products p ON ri.product_id = p.id
            WHERE ri.request_id = ?`,
      args: [requestId],
    }),
  ]);

  if (!reqResult.rows.length) throw new Error(`Request ${requestId} not found`);

  const r = reqResult.rows[0];
  const year = String(r.request_date).slice(0, 4);
  const reference = `SO-${year}-${String(r.id).padStart(3, "0")}`;

  const subtotal = itemsResult.rows.reduce(
    (sum: number, item: Record<string, unknown>) => sum + Number(item.total_price),
    0
  );
  const taxAmount = Math.round((subtotal * Number(r.vat_percent)) / 100);

  return {
    id: String(r.id),
    reference,
    customerId: String(r.customer_id),
    customer: {
      id: String(r.customer_id),
      name: String(r.customer_name),
      email: null,
      phone: r.customer_phone ? String(r.customer_phone) : null,
    },
    status: STATUS_MAP[String(r.status)] ?? "PENDING",
    priority: "NORMAL",
    orderDate: r.created_at
      ? new Date(String(r.created_at)).toISOString()
      : new Date().toISOString(),
    requiredDate: null,
    subtotal,
    taxAmount,
    totalAmount: subtotal + taxAmount,
    currency: "TZS",
    notes: null,
    lines: itemsResult.rows.map((item: Record<string, unknown>) => ({
      id: String(item.id),
      productCode: `PROD-${item.product_id}`,
      description: String(item.product_name),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      discount: 0,
      totalPrice: Number(item.total_price),
    })),
  };
}

export async function sendOrderEvent(
  event: "order.created" | "order.updated" | "order.cancelled",
  requestId: number | string
): Promise<void> {
  try {
    if (event === "order.cancelled") {
      const row = await db.execute({
        sql: "SELECT id, request_date FROM requests WHERE id = ?",
        args: [requestId],
      });
      if (!row.rows.length) return;
      const r = row.rows[0];
      const year = String(r.request_date).slice(0, 4);
      void sendImsEvent(event, {
        id: String(r.id),
        reference: `SO-${year}-${String(r.id).padStart(3, "0")}`,
      });
      return;
    }

    const payload = await fetchOrderPayload(requestId);
    void sendImsEvent(event, payload);
  } catch (err) {
    console.error(
      `[IMS] Failed to build payload for ${event} (request ${requestId}):`,
      err
    );
  }
}

export async function sendKpiUpdate(month: string): Promise<void> {
  try {
    const [revenueRow, ordersRow, newCustRow] = await Promise.all([
      db.execute({
        sql: `SELECT COALESCE(SUM(ri.total_price), 0) AS total
              FROM request_items ri
              JOIN requests r ON ri.request_id = r.id
              WHERE r.status IN ('approved','dispatched')
              AND strftime('%Y-%m', r.created_at) = ?`,
        args: [month],
      }),
      db.execute({
        sql: `SELECT COUNT(DISTINCT r.id) AS total
              FROM requests r
              WHERE r.status IN ('approved','dispatched')
              AND strftime('%Y-%m', r.created_at) = ?`,
        args: [month],
      }),
      db.execute({
        sql: `SELECT COUNT(*) AS total FROM customers
              WHERE strftime('%Y-%m', created_at) = ?`,
        args: [month],
      }),
    ]);

    const revenue = Number(revenueRow.rows[0].total) || 0;
    const orders = Number(ordersRow.rows[0].total) || 0;
    const newCustomers = Number(newCustRow.rows[0].total) || 0;

    void sendImsEvent("kpi.updated", [
      { period: month, metric: "REVENUE", target: 0, achieved: revenue, currency: "TZS" },
      { period: month, metric: "ORDERS", target: 0, achieved: orders, currency: "TZS" },
      {
        period: month,
        metric: "NEW_CUSTOMERS",
        target: 0,
        achieved: newCustomers,
        currency: "TZS",
      },
      {
        period: month,
        metric: "AVG_ORDER_VALUE",
        target: 0,
        achieved: orders > 0 ? Math.round(revenue / orders) : 0,
        currency: "TZS",
      },
    ]);
  } catch (err) {
    console.error("[IMS] Failed to compute KPI data:", err);
  }
}
