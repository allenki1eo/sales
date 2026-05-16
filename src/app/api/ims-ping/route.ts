import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const baseUrl = process.env.IMS_BASE_URL;
  const secret = process.env.SALES_WEBHOOK_SECRET;

  const configured = !!baseUrl && !!secret;

  if (!configured) {
    return NextResponse.json(
      { ok: false, reason: "IMS_BASE_URL or SALES_WEBHOOK_SECRET not configured" },
      { status: 503 }
    );
  }

  try {
    const body = JSON.stringify({ event: "ping" });
    const sig =
      "sha256=" + crypto.createHmac("sha256", secret!).update(body).digest("hex");

    const res = await fetch(`${baseUrl}/api/webhooks/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sales-signature": sig,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });

    return NextResponse.json(
      { ok: res.ok, status: res.status },
      { status: res.ok ? 200 : 502 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, reason: err?.message ?? "unreachable" },
      { status: 502 }
    );
  }
}
