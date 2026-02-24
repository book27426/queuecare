import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff, verifyUser } from "@/lib/auth";

export async function POST(req) {
  const client = await db.connect();

  try {
    const { searchParams} = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id is required" },
        { status: 400 }
      );
    }
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;
    
    const staff_id = auth.staff_id;
    if (auth.role === "staff"){
      return NextResponse.json(
        { message: "reject" },
        { status: 400 }
      );
    }

    // 2. Get request body

    const wait = Number(wait_default ?? 5);
    const parent = parent_id ? Number(parent_id) : null;

    if (
      isNaN(wait) || wait < 0 ||
      isNaN(depth) || depth < 0) {
      return NextResponse.json(
        { message: "invalid numeric values" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    let depth = 0;

    if (parent) {
      const parentCheck = await client.query(
        `SELECT id FROM section WHERE id=$1`,
        [parent]
      );

      if (!parentCheck.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "parent section not found" },
          { status: 400 }
        );
      }

      depth = parentCheck.rows[0].depth_int + 1;
    }

    if (depth > 5) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "maximum depth exceeded" },
        { status: 400 }
      );
    }

    // 3. Insert section
    const section = await client.query(
      `INSERT INTO section 
        (name, parent_id, wait_default, predict_time, depth_int)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, parent, wait, wait, depth]
    );

    const detail = `Created section ${section.rows[0].id} (${name})`;
    await client.query(
      `INSERT INTO log (staff_id, action_type,action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "create",detail, "section"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true,data: section.rows[0]}, { status: 201 });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(err);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}