import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req, context) {
  const { id } = await context.params;
  const { staff_id,section_id,queue_detail, } = await req.json();

  await db.query(
    `UPDATE queue
     SET status='sented',detail=$2,staff_id=$3
     WHERE id=$1`,
    [id,queue_detail,staff_id]
  );

  await db.query(
    `INSERT INTO queue (number,detail,queue_date,user_id,section_id)
     SELECT number,detail,queue_date,user_id,$2 FROM queue WHERE id=$1`,
    [id, section_id,]
  );
  const detail = `update queue = ${id} to transfer create new queue at section ${section_id}`;
  await db.query(
    `INSERT INTO log (staff_id, action_type, action, target)
    VALUES ($1, $2, $3, $4)`,
    [staff_id, "update", detail, "user"]
  );

  return NextResponse.json({ message: "transferred" });
}
