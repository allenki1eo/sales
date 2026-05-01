import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, username, full_name, role, created_at FROM users ORDER BY full_name ASC"
  );

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { username, full_name, password, role } = body;

  if (!username || !full_name || !password || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const [existing] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM users WHERE username = ?",
    [username]
  );

  if (existing.length) {
    return NextResponse.json({ error: "Username already taken" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users (username, full_name, password, role) VALUES (?, ?, ?, ?)",
    [username, full_name, hashedPassword, role]
  );

  return NextResponse.json({ id: result.insertId }, { status: 201 });
}
