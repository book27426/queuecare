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
    const { first_name, last_name, role, section_id, staff_id } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE staff
       SET first_name=$1, last_name=$2, role=$3, section_id=$4
       WHERE id=$5 AND is_deleted=false`,
      [first_name, last_name, role, section_id, id]
    );

    const detail = "queueu_list_id = " + id +" change ..."///add more
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "staff"]
    );

    if (!rowCount)
      return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ message: "updated" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}

export async function DELETE(_, context) {
  try {
    const { id } = await context.params;
    await db.query(
      `UPDATE staff SET is_deleted=true WHERE id=$1`,
      [id]
    );

    return NextResponse.json({ message: "deleted" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}
