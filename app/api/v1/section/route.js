import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {

    const { name, parent_id, depth_int, staff_id } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `INSERT INTO section (name, parent_id, wait_default, predict_time, depth_int)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, parent_id || null,wait_default || 5,predict_time || 5, depth_int || 0]
    );

    await db.query(
      `INSERT INTO log (staff_id, action_type,target)
       VALUES ($1, $2, $3)`,
      [staff_id, "create", "section"]
    );

    return NextResponse.json(rows[0], { status: 201 });

}
