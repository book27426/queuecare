import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const { name, wait_default, section_id } = await req.json();

    if (!name || !section_id) {
      return NextResponse.json(
        { message: "name and section_id required" },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `INSERT INTO queue_list (name, wait_default, section_id)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name, wait_default || 0, section_id]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: "Failed to create queue list" },
      { status: 500 }
    );
  }
}
