import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_, context) {
  const { id } = await context.params;
  const { rows } = await db.query(
    `SELECT * FROM users WHERE id=$1 AND is_deleted=false`,
    [id]
  );

  if (!rows.length)
    return NextResponse.json({ message: "not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function PUT(req, context) {
  const { id } = await context.params;
  const { name, phone_num, staff_id } = await req.json();
  await db.query(
    `UPDATE users SET name=$1, phone_num=$2 WHERE id=$3`,
    [name, phone_num, id]
  );

  const detail = "user_id = "+id+" change ..."//addmore need 
  await db.query(
    `INSERT INTO log (staff_id, action_type, action, target)
    VALUES ($1, $2, $3, $4)`,
    [staff_id, "update", detail, "user"]
  );

  return NextResponse.json({ message: "updated" });
}

export async function DELETE(req, context) {
  const { id } = await context.params;
  const { staff_id } = await req.json();
  await db.query(
    `UPDATE users SET is_deleted=true WHERE id=$1`,
    [id]
  );

  const detail = "user_id = " + id
  await db.query(
    `INSERT INTO log (staff_id, action_type, action, target)
    VALUES ($1, $2, $3, $4)`,
    [staff_id, "delete", detail, "user"]
  );

  return NextResponse.json({ message: "deleted" });
}
