import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.id === params.id) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [params.id] });
  return NextResponse.json({ success: true });
}
