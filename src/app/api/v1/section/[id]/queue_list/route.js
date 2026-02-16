import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_, { params }) {
  const { rows } = await db.query(
    `SELECT * FROM queue_list WHERE section_id=$1 AND is_deleted=false`,
    [params.id]
  );

  return NextResponse.json(rows);
}
