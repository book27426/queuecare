import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_, { params }) {
  const { rows } = await db.query(
    `SELECT * FROM section
     WHERE id=$1 AND is_deleted=false`,
    [params.id]
  );

  if (!rows.length)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function PUT(req, { params }) {
  try {
    const { name, parent_id, depth_int } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE section
       SET name=$1, parent_id=$2, depth_int=$3
       WHERE id=$4 AND is_deleted=false`,
      [name, parent_id || null, depth_int || 0, params.id]
    );

    if (!rowCount)
      return NextResponse.json({ message: "Not found" }, { status: 404 });

    return NextResponse.json({ message: "Updated" });
  } catch {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}

export async function DELETE(_, { params }) {
  await db.query(
    `UPDATE section SET is_deleted=true WHERE id=$1`,
    [params.id]
  );

  return NextResponse.json({ message: "Soft deleted" });
}
