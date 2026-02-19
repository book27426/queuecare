import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req, context) {
  const { id } = await context.params;
  const { staff_id } = await req.json();
  const { rowCount } = await db.query(
    `UPDATE queue
     SET status='cancel', end_at=NOW()
     WHERE id=$1`,
    [id]
  );

  if (!rowCount) {
    return NextResponse.json(
      { message: "Queue is not serving or not found" },
      { status: 400 }
    );
  }else{
    const detail = `update queue = ${id} to cancel`;

    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "user"]
    );

    return NextResponse.json({ message: "cancel" });
  }
}
