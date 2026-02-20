import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req) {
  try {
    // 1. Get request body
    const body = await req.json();

    const { name, phone_num} = body;
    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    // 2. Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // 3. Insert section
    const { rows } = await db.query(
      `INSERT INTO users (name, phone_num)
       VALUES ($1, $2)
       RETURNING id`,
      [name, phone_num]
    );

    const user_id = rows[0].id;

    await db.query(
      `INSERT INTO user_token (token, user_id)
       VALUES ($1, $2)`,
      [token, user_id]
    );

    await db.query(
      `INSERT INTO log (user_id, action_type,target)
       VALUES ($1, $2, $3)`,
      [user_id, "create", "user"]
    );

    return NextResponse.json("create", { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: err.message },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const [rows] = await db.query("SELECT * FROM users");

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
}