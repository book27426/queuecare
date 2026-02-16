import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req, { params }) {
  try {
    const { id } = params;
    const { first_name, last_name, role, section_id } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE staff
       SET first_name=$1, last_name=$2, role=$3, section_id=$4
       WHERE id=$5 AND is_deleted=false`,
      [first_name, last_name, role, section_id, id]
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

    return NextResponse.json({ message: "deleted" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}
