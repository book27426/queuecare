import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const { wait_default, name, section_id, staff_id } = await req.json();

    if (!wait_default || !name || !section_id) {
      return NextResponse.json({ message: "role and token required" }, { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO queue_list (wait_default, name, section_id)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [wait_default, name, section_id]
    );

    await db.query(
      `INSERT INTO log (staff_id, action_type,target)
       VALUES ($1, $2, $3)`,
      [staff_id, "create", "user"]
    );
    
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: "error creating queue_list" }, { status: 500 });
  }
}