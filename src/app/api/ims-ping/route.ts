import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendImsEvent } from "@/lib/ims-webhook";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const baseUrl = process.env.IMS_BASE_URL;
  const secret = process.env.SALES_WEBHOOK_SECRET;

  if (!baseUrl || !secret) {
    return NextResponse.json({
      ok: false,
      error: "IMS_BASE_URL or SALES_WEBHOOK_SECRET is not set",
      IMS_BASE_URL: baseUrl ? "set" : "MISSING",
      SALES_WEBHOOK_SECRET: secret ? "set" : "MISSING",
    });
  }

  const start = Date.now();

  try {
    await sendImsEvent("ping", { message: "Connection test from sales app", timestamp: new Date().toISOString() });

    return NextResponse.json({
      ok: true,
      imsUrl: baseUrl,
      latencyMs: Date.now() - start,
      message: "Ping sent — check IMS logs or server console for [IMS] ping → 200",
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message ?? "Unknown error",
      latencyMs: Date.now() - start,
    });
  }
}
