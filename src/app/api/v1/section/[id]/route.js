import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_, context) {
  const { id } = await context.params;
  const { rows } = await db.query(
    `SELECT * FROM section
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
    const { name, parent_id, depth_int, staff_id } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE section
       SET name=$1, parent_id=$2, depth_int=$3
       WHERE id=$4 AND is_deleted=false`,
      [name, parent_id || null, depth_int || 0, id]
    );

    const detail = "section_id = " + id + " change ..."////addmore

    await db.query(
      `INSERT INTO log (staff_id, action_type,target)
       VALUES ($1, $2, $3)`,
      [staff_id, "update", detail, "section"]
    );

    if (!rowCount)
      return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ message: "Updated" });
  } catch {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  try {
    const { id } = await context.params;
    const { staff_id } = await req.json();

    await db.query(
      `UPDATE section SET is_deleted=true WHERE id=$1`,
      [id]
    );

    const detail = "section = " + id
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "section"]
    );

    return NextResponse.json({ message: "Soft deleted" });
  } catch {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
