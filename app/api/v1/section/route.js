import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
export async function POST(req) {
  const client = await db.connect();

  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;
    
    const staff_id = auth.staff_id;
    // 2. Get request body
    const {
      name,
      parent_id,
      depth_int,
      wait_default,
      predict_time
    } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    const wait = Number(wait_default ?? 5);
    const predict = Number(predict_time ?? 5);
    const depth = Number(depth_int ?? 0);
    const parent = parent_id ? Number(parent_id) : null;

    if (
      isNaN(wait) || wait < 0 ||
      isNaN(predict) || predict < 0 ||
      isNaN(depth) || depth < 0) {
      return NextResponse.json(
        { message: "invalid numeric values" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

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
    }

    // 3. Insert section
    const section = await client.query(
      `INSERT INTO section 
        (name, parent_id, wait_default, predict_time, depth_int)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, parent, wait, predict, depth]
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

export async function GET(req) {
  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || isNaN(sectionId)) {
      return NextResponse.json(
        { message: "valid id is required" },
        { status: 400 }
      );
    }

    // 3. GET section
    const { rows } = await db.query(
      `SELECT * FROM section
      WHERE id=$1 AND is_deleted=false`,
      [id]
    );

    if (!rows.length)
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );

    return NextResponse.json(rows[0]);

  } catch (err) {
    console.error("Get section error:", err);
    return NextResponse.json(
      { message: "Internal server error" },
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

    // 3. Get request body
    const { name, parent_id} = await req.json();

    const sectionId = Number(id);
    const parent = parent_id ? Number(parent_id) : null;

    if (isNaN(sectionId) || (parent !== null && isNaN(parent))) {
      return NextResponse.json(
        { message: "invalid numeric values" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    if (parent === sectionId) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "section cannot be its own parent" },
        { status: 400 }
      );
    }

    let depth = 0;

    if (parent !== null) {
      const parentRow = await client.query(
        `SELECT depth_int FROM section 
        WHERE id=$1 AND is_deleted=false`,
        [parent]
      );

      if (!parentRow.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "parent section not found" },
          { status: 400 }
        );
      }

      depth = parentRow.rows[0].depth_int + 1;
    }

    if (!name || name.trim() === "") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    // 4. Update section
    const { rowCount } = await client.query(
      `UPDATE section
       SET name=$1, parent_id=$2, depth_int=$3
       WHERE id=$4 AND is_deleted=false`,
      [name, parent, depth, sectionId]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );
    }

    const detail = `Updated section ${sectionId}:name=${name}, parent=${parent}, depth=${depth}`;

    await client.query(
      `INSERT INTO log (staff_id, action_type, action,target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "section"]
    );

    await client.query("COMMIT");
    return NextResponse.json({ message: "Updated" });
  } catch (err) {
    console.error("Update section error:", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json({ message: "Error" }, { status: 500 });
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
      `UPDATE section SET is_deleted=true WHERE id=$1`,
      [id]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );
    }

    // 4. INSERT log
    const detail = "section_id = " + id
    await client.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "section"]
    );

    await client.query("COMMIT");
    return NextResponse.json({ message: "deleted" });
  } catch {
    console.error("DELETE section error:", err);
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json({ message: "Error" }, { status: 500 });
  } finally {
    client.release();
  }
}
