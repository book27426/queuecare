import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_, { params }) {
  const { rows } = await db.query(
    `SELECT * FROM queue_list
     WHERE id=$1 AND is_deleted=false`,
    [params.id]
  );

  if (!rows.length)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  return NextResponse.json(rows[0]);
}

export async function PUT(req, { params }) {
  try {
    const { name, wait_default, section_id } = await req.json();

    const { rowCount } = await db.query(
      `UPDATE queue_list
       SET name=$1, wait_default=$2, section_id=$3
       WHERE id=$4 AND is_deleted=false`,
      [name, wait_default || 0, section_id, params.id]
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
    `UPDATE queue_list SET is_deleted=true WHERE id=$1`,
    [params.id]
  );

  return NextResponse.json({ message: "Soft deleted" });
}
