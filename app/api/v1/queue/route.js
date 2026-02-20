import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUser } from "@/lib/auth";
export async function POST(req) {
  try {
    // 🔐 1. Verify staff
    const auth = await verifyUser(req);
    if (auth.error) return auth.error;
    
    const user_id = auth.user_id;

    // 📦 2. Get request body
    const { section_id } = await req.json();

    if (!section_id) {
      return NextResponse.json(
        { message: "section_id is required" },
        { status: 400 }
      );
    }
    
    // 3. generate number
    const lastQueue = await db.query(
      `SELECT number FROM queue
       WHERE section_id=$1
       ORDER BY id DESC
       LIMIT 1`,
      [section_id]
    );

    let number = "001";

    if (lastQueue.rows.length > 0) {
      const lastNumber = parseInt(lastQueue.rows[0].number, 10);
      number = String(lastNumber + 1).padStart(3, "0");
    }

    // 💾 4. Insert section
    const queue = await db.query(
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

    return NextResponse.json({ success: true,data: queue.rows[0]}, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  }
};