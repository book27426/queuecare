import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const { first_name, last_name, role, section_id, staff_id, email } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE staff
       SET first_name=$1, last_name=$2, role=$3, section_id=$4, email=$5
       WHERE id=$6 AND is_deleted=false`,
      [first_name, last_name, role, section_id, email, id]
    );

    const detail = "staff_id = " + id +" change ..."///add more
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

export async function DELETE(_, { params }) {
  try {
    await db.query(
      `UPDATE staff SET is_deleted=true WHERE id=$1`,
      [params.id]
    );

    const detail = "staff_id = " + params.id
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "staff"]
    );

    return NextResponse.json({ message: "deleted" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}
