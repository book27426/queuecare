import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff, verifyFirebaseToken } from "@/lib/auth";


export async function POST(req) {
  let email, first_name, last_name, uid;
  const role = "staff";

  try {
    const user = await verifyFirebaseToken(req);
    email = user.email
    first_name = user.first_name
    last_name = user.last_name
    uid = user.uid
  } catch (err) { return NextResponse.json( { message: "Unauthorized" }, { status: 401 } ); }

  try {
    let result;
    let actionType = "create";
    let statusCode = 201;
    let actionDetail = null;
    
    const existing = await db.query(
      `SELECT id, is_deleted FROM staff WHERE uid=$1`,
      [uid]
    );

    const staff = existing.rows[0];

    if (staff && staff.is_deleted) {
      // Exists & is_deleted
      result = await db.query(
        `UPDATE staff
        SET is_deleted = false
        WHERE uid=$1
        RETURNING *`,
        [uid]
      );

      actionType = "update";
      actionDetail = "reactivate";
      statusCode = 200;
      const staff_id = result.rows[0].id;

      await db.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, actionType,actionDetail, "staff"]
      );
    }else if (staff && !staff.is_deleted) {
      // Already exists
      result = await db.query(
        `SELECT * FROM staff WHERE uid=$1`,
        [uid]
      );
      statusCode = 200;

    } else{
      // 3. Insert section
      result = await db.query(
        `INSERT INTO staff (role, first_name, last_name, uid, email)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *`,
        [role, first_name, last_name, uid, email]
      );
      actionType = "create";
      statusCode = 201;
      const staff_id = result.rows[0].id;

      await db.query(
        `INSERT INTO log (staff_id, action_type, action, target)
         VALUES ($1, $2, $3, $4)`,
        [staff_id, actionType,actionDetail, "staff"]
      );
    }

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: statusCode }
    );

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "error creating staff" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id is required" },
        { status: 400 }
      );
    }

    const { rows } = await db.query(
      `SELECT id, first_name, last_name, role, section_id, email FROM staff
      WHERE id=$1 AND is_deleted=false`,
      [id]
    );

  if (!rows.length) {
    return NextResponse.json(
      { message: "Not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, data: rows[0] },
    { status: 200 }
  );
  } catch {
    return NextResponse.json(
      { message: "error" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;
    
    const staff_id = auth.staff_id;
    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id is required" },
        { status: 400 }
      );
    }
    // 3. Get request body
    const { first_name, last_name, role, section_id, email } = await req.json();

    if (
      first_name === undefined &&
      last_name === undefined &&
      role === undefined &&
      section_id === undefined &&
      email === undefined
    ) {
      return NextResponse.json(
        { message: "No fields to update" },
        { status: 400 }
      );
    }

    // 4. Update staff
    const { rowCount } = await db.query(
      `UPDATE staff
       SET 
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         role = COALESCE($3, role),
         section_id = COALESCE($4, section_id),
         email = COALESCE($5, email)
       WHERE id=$6 AND is_deleted=false`,
      [first_name, last_name, role, section_id, email, id]
    );

    if (!rowCount) {
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );
    }

    // 5. Insert log
    const changes = [];

    if (first_name !== undefined) changes.push("first_name");
    if (last_name !== undefined) changes.push("last_name");
    if (role !== undefined) changes.push("role");
    if (section_id !== undefined) changes.push("section_id");
    if (email !== undefined) changes.push("email");

    const detail = `Updated staff ${id}: ${changes.join(", ")}`;
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "staff"]
    );

    return NextResponse.json({ message: "updated" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;
    
    const staff_id = auth.staff_id;

    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id is required" },
        { status: 400 }
      );
    }

    // 3. Soft delete
    const { rowCount } = await db.query(
      `UPDATE staff SET is_deleted=true WHERE id=$1 AND is_deleted=false`,
      [id]
    );

    if (!rowCount) {
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );
    }

    // 4. Insert log
    const detail = "staff_id = " + id
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "staff"]
    );

    return NextResponse.json({ message: "deleted" });
  } catch {
    return NextResponse.json({ message: "error" }, { status: 500 });
  }
}
