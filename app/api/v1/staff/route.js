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

  const client = await db.connect();

  try {
    let result;
    let actionType = "create";
    let statusCode = 201;
    let actionDetail = null;
    
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, is_deleted FROM staff WHERE uid=$1`,
      [uid]
    );

    const staff = existing.rows[0];

    if (staff && staff.is_deleted) {
      // Exists & is_deleted
      result = await client.query(
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

      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, actionType,actionDetail, "staff"]
      );
    }else if (staff && !staff.is_deleted) {
      // Already exists
      result = await client.query(
        `SELECT * FROM staff WHERE uid=$1`,
        [uid]
      );
      statusCode = 200;

    } else{
      // 3. Insert section
      result = await client.query(
        `INSERT INTO staff (role, first_name, last_name, uid, email)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING *`,
        [role, first_name, last_name, uid, email]
      );
      actionType = "create";
      statusCode = 201;
      const staff_id = result.rows[0].id;

      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
         VALUES ($1, $2, $3, $4)`,
        [staff_id, actionType,actionDetail, "staff"]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: statusCode }
    );

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(err);
    return NextResponse.json(
      { message: "error creating staff" },
      { status: 500 }
    );
  } finally {
    client.release();
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
  const client = await db.connect();

  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    if (!["admin", "super_admin"].includes(auth.role)) {
      const { invite_code } = await req.json();

      if(!invite_code){
        return NextResponse.json(
          { message: "invite_code is required" },
          { status: 400 }
        );
      }

      await client.query("BEGIN");

      const { rows } = await client.query(
        `SELECT id
        FROM section
        WHERE invite_code = $1
          AND code_outdate >= NOW()
          AND is_deleted = false`,
        [invite_code]
      );

      if (!rows.length) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "invalid or expired invite code" },
          { status: 400 }
        );
      }

      const section_id = rows[0].id;

      const result = await client.query(
        `UPDATE staff
        SET section_id = $2
        WHERE id = $1
          AND is_deleted = false
        RETURNING *`,
        [auth.staff_id, section_id]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "staff not found" },
          { status: 404 }
        );
      }
      await client.query("COMMIT");

      return NextResponse.json({ success: true,data: result.rows[0]}, { status: 200 });
    }
    
    const staff_id = auth.staff_id;
    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id)) {
      return NextResponse.json(
        { message: "valid id is required" },
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

    if (staff_id === id) {
      return NextResponse.json(
        { message: "cannot change your own role" },
        { status: 400 }
      );
    }

    const { rows: targetRows } = await client.query(
      `SELECT role FROM staff WHERE id=$1`,
      [id]
    );

    if (!targetRows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const targetRole = targetRows[0].role;

    if (targetRole === "super_admin" && auth.role !== "super_admin") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "cannot modify super_admin" },
        { status: 403 }
      );
    }

    if (auth.role != "super_admin" && role == "super_admin"){
      return NextResponse.json(
        { message: "admin can't create super_admin" },
        { status: 403 }
      );
    }

    await client.query("BEGIN");

    // 4. Update staff
    const result = await client.query(
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

    if (!result.rowCount) {
      await client.query("ROLLBACK");
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
    await client.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "staff"]
    );

    await client.query("COMMIT");
    return NextResponse.json({ success: true,data: result.rows[0]}, { status: 200 });
  } catch (err) {
    console.error("Update staff error:", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json({ message: "error" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(req) {
  const client = await db.connect();
  
  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    if (!["admin", "super_admin"].includes(auth.role)) {
      return NextResponse.json(
        { message: "admin only" },
        { status: 403 }
      );
    }
    
    const staff_id = auth.staff_id;

    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { message: "valid id is required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // 3. Soft delete
    const { rowCount } = await client.query(
      `UPDATE staff SET is_deleted=true WHERE id=$1 AND is_deleted=false`,
      [id]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );
    }

    // 4. Insert log
    const detail = `Deleted staff ${id}`;
    await client.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "staff"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ message: "deleted" });
  } catch (err) {
    console.error("DELETE staff error:", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json({ message: "error" }, { status: 500 });
  } finally {
    client.release();
  }
}
