import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const { role, first_name, last_name, token, section_id, staff_id } = await req.json();

    if (!role || !token) {
      return NextResponse.json({ message: "role and token required" }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO staff (role, first_name, last_name, token, section_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [role, first_name, last_name, token, section_id]
    );

    await db.query(
      `INSERT INTO log (staff_id, action_type,target)
       VALUES ($1, $2, $3)`,
      [staff_id, "create", "user"]
    );
    
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: "error creating staff" }, { status: 500 });
  }
}