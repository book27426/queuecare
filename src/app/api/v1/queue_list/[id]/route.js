import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_, context) {
  const { id } = await context.params;
  const { rows } = await db.query(
    `SELECT * FROM queue_list
     WHERE id=$1 AND is_deleted=false`,
    [id]
  );

  if (!rows.length)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function PUT(req, context) {
  try {
    const { id } = await context.params;

    const { wait_default, name, section_id, staff_id } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE queue_list
       SET wait_default=$1, name=$2, section_id=$3
       WHERE id=$4 AND is_deleted=false`,
      [wait_default, name, section_id, id]
    );

    const detail = "queueu_list_id = " + id +" change ..."///add more
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "queue_list"]
    );

    if (!rowCount)
      return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ message: "updated" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  try {
    const { id } = await context.params;
    const { staff_id } = await req.json();
    await db.query(
      `UPDATE queue_list SET is_deleted=true WHERE id=$1`,
      [id]
    );
    const detail = "queue_list = " + id
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "queue_list"]
    );

    return NextResponse.json({ message: "deleted" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}
