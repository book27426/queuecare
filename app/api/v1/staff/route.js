import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req) {
  try {
    // 1. Get request body
    const { role, first_name, last_name, email } = await req.json();

    if (!role || !email || !first_name) {
      return NextResponse.json(
        { message: "role, email and first_name are required" },
        { status: 400 }
      );
    }

    // 2. Generate secure token
    const token = crypto.randomBytes(32).toString("hex");

    // 3. Insert section
    const { rows } = await db.query(
      `INSERT INTO staff (role, first_name, last_name, token, email)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [role, first_name, last_name, token, email]
    );

    const staff_id = rows[0].id;

    await db.query(
      `INSERT INTO log (staff_id, action_type, target)
       VALUES ($1, $2, $3)`,
      [staff_id, "create", "staff"]
    );

    return NextResponse.json(
      { success: true, data: rows[0] },
      { status: 201 }
    );

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "error creating staff" },
      { status: 500 }
    );
  }
}