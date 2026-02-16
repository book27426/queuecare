import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  try {
    const { name, parent_id, depth_int } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `INSERT INTO section (name, parent_id, depth_int)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name, parent_id || null, depth_int || 0]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { message: "Failed to create section" },
      { status: 500 }
    );
  }
}
