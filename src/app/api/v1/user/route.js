import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const body = await req.json();

    const { name, cookie_token, phone_num} = body;

    if (!cookie_token) {
      return NextResponse.json(
        { message: "cookie are required" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO user (name, cookie_token, phone_num)
       VALUES ($1, $2, $3)`,
      [name, cookie_token, phone_num]
    );

    const user_id = result.rows[0].id;
    
    await db.query(
      `INSERT INTO log (user_id, action_type, target)
       VALUES ($1, $2, $3, $4)`,
      [user_id, "create", "user"]
    );

    return NextResponse.json(queue, { status: 201 });
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