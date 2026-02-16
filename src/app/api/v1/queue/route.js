import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  const { number, user_id, queue_list_id } = await req.json();

  const { rows } = await db.query(
    `INSERT INTO queue (number, user_id, queue_list_id)
     VALUES ($1,$2,$3)
     RETURNING *`,
    [number, user_id, queue_list_id]
  );

  return NextResponse.json(rows[0], { status: 201 });
}

export async function GET() {
  const { rows } = await db.query(
    `SELECT * FROM queue WHERE queue_date=CURRENT_DATE`
  );

  return NextResponse.json(rows);
}
