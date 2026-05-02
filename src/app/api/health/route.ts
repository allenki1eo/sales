import { NextResponse } from "next/server";

export async function GET() {
  const checks = {
    TURSO_DATABASE_URL: !!process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN:   !!process.env.TURSO_AUTH_TOKEN,
    NEXTAUTH_SECRET:    !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL:       process.env.NEXTAUTH_URL || "(not set)",
  };

  const dbOk = await (async () => {
    try {
      const { createClient } = await import("@libsql/client");
      const client = createClient({
        url:       process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      await client.execute("SELECT 1");
      return true;
    } catch (e: any) {
      return e?.message || "failed";
    }
  })();

  const allOk = checks.TURSO_DATABASE_URL && checks.TURSO_AUTH_TOKEN &&
                checks.NEXTAUTH_SECRET && dbOk === true;

  return NextResponse.json({ ok: allOk, checks, db: dbOk }, {
    status: allOk ? 200 : 500,
  });
}
