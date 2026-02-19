import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  const { number, user_id, section_id } = await req.json();

  const { rows } = await db.query(
    `INSERT INTO queue (number, user_id, section_id)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [number, user_id, section_id]
  );

  await db.query(
    `INSERT INTO log (user_id, action_type,target)
      VALUES ($1, $2, $3)`,
    [user_id, "create", "queue"]
  );

  return NextResponse.json(rows[0], { status: 201 });
};