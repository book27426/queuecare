import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
export async function POST(req) {
  const client = await db.connect();

  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;
    
    const staff_id = auth.staff_id;
    // 2. Get request body
    const {
      name,
      parent_id,
      depth_int,
      wait_default,
      predict_time
    } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 3. Insert section
    const section = await db.query(
      `INSERT INTO section 
        (name, parent_id, wait_default, predict_time, depth_int)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [
        name,
        parent_id ?? null,
        wait_default ?? 5,
        predict_time ?? 5,
        depth_int ?? 0
      ]
    );

    await db.query(
      `INSERT INTO log (staff_id, action_type, target)
       VALUES ($1, $2, $3)`,
      [staff_id, "create", "section"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true,data: section.rows[0]}, { status: 201 });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(err);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}