import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(_, { params }) {
  await db.query(
    `UPDATE queue
     SET status='no_show', end_at=NOW()
     WHERE id=$1 AND status='serving'`,
    [params.id]
  );

  return NextResponse.json({ message: "no_show" });
}
