import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
export async function POST(req) {
  const client = await db.connect();

  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;
    
    if (!["admin", "super_admin"].includes(auth.role)) {
      return NextResponse.json(
        { success: false, message: "Forbidden - admin only" },
        { status: 403 }
      );
    }

    const staff_id = auth.staff_id;
    // 2. Get request body
    const {
      name,
      parent_id,
      wait_default
    } = await req.json();

    if (!name) {
      return NextResponse.json(
        { success: false, message: "name is required" },
        { status: 400 }
      );
    }

    const wait = Number(wait_default ?? 5);
    const parent = parent_id ? Number(parent_id) : null;

    if (
      isNaN(wait) || wait < 0) {
      return NextResponse.json(
        { success: false, message: "invalid numeric values" },
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
          { success: false, message: "parent section not found" },
          { status: 400 }
        );
      }

      depth = parentCheck.rows[0].depth_int + 1;
    }

    if (depth > 5) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "maximum depth exceeded" },
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

    return NextResponse.json({ success: true, data: section.rows[0]}, { status: 201 });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(err);
    return NextResponse.json(
      { success: false, message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function GET(req) {
  try {
    // 1. Get id params
    const { searchParams} = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");

    /// 2.check User search
    if (name) {

      const { rows } = await db.query(
        `
        SELECT id, name, wait_default, predict_time
        FROM section
        WHERE name ILIKE '%' || $1 || '%'
        AND is_deleted = false AND depth_int = 0
        `,
        [name]
      );

      return NextResponse.json({
        success: true,
        mode: "public-search",
        data: rows
      });
    }

    // 2. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    const { section_id: staffSectionId } = auth;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "id is required" },
        { status: 400 }
      );
    }

    const sectionId = Number(id);

    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      return NextResponse.json(
        { success: false, message: "valid id is required" },
        { status: 400 }
      );
    }

    // 3. GET section
    const { rows: sectionRows } = await db.query(
      `SELECT * FROM section
       WHERE id=$1 AND is_deleted=false`,
      [sectionId]
    );

    if (!sectionRows.length) {
      return NextResponse.json(
        { success: false, message: "Not found" },
        { status: 404 }
      );
    }

    const section = sectionRows[0];

    // ✅ CASE A: Staff belongs to THIS section
    if (staffSectionId === sectionId) {
      const { rows: subSections } = await db.query(
        `SELECT * FROM section
         WHERE parent_id = $1
         AND is_deleted=false`,
        [sectionId]
      );

      const { rows: queues } = await db.query(
        `SELECT * FROM queue
         WHERE section_id = $1
         AND status='waiting'`,
        [sectionId]
      );

      const { rows: sectionIdsRows } = await db.query(
        `
        SELECT id
        FROM section
        WHERE id = $1
          OR parent_id = $1
        `,
        [sectionId]
      );

      const sectionIds = sectionIdsRows.map(row => row.id);

      const { rows: staffs } = await db.query(
        `
        SELECT id, first_name, last_name
        FROM staff
        WHERE section_id = ANY($1)
          AND is_deleted = false
        ORDER BY first_name ASC
        `,
        [sectionIds]
      );

      // 1️⃣ Hourly breakdown
      const { rows: hourlyRows } = await db.query(
        `
        SELECT
          TO_CHAR(date_trunc('hour', created_at), 'HH24:00') AS hour,
          COUNT(*) FILTER (WHERE status != 'cancel') AS new_queue,
          COUNT(*) FILTER (WHERE status = 'complete') AS complete
        FROM queue
        WHERE section_id = $1
          AND created_at >= CURRENT_DATE
        GROUP BY 1
        ORDER BY 1
        `,
        [sectionId]
      );

      // 2️⃣ Average operation time
      const { rows: avgRows } = await db.query(
        `
        SELECT
          AVG(EXTRACT(EPOCH FROM (end_at - start_at)) / 60)
            AS avg_operation_minutes
        FROM queue
        WHERE section_id = $1
          AND status = 'complete'
          AND start_at IS NOT NULL
          AND end_at IS NOT NULL
          AND end_at >= CURRENT_DATE
        `,
        [sectionId]
      );

      // 3️⃣ Totals
      const { rows: totalRows } = await db.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status != 'cancel') AS total_new,
          COUNT(*) FILTER (WHERE status = 'complete') AS total_complete
        FROM queue
        WHERE section_id = $1
          AND created_at >= CURRENT_DATE
        `,
        [sectionId]
      );

      const now = new Date();
      const hoursPassed = Math.max(now.getHours() - 8, 1); // prevent divide by 0

      const stats = {
        est_new_queue_per_hour:
          Number(totalRows[0].total_new) / hoursPassed,

        est_complete_case_per_hour:
          Number(totalRows[0].total_complete) / hoursPassed,

        est_avg_operation_time_per_case_minutes:
          Number(avgRows[0].avg_operation_minutes) || 0,

        hourly_breakdown: hourlyRows,

        last_updated: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        mode: "main-section",
        section : section,
        stats: stats,
        sub_sections: subSections,
        queues: queues,
        staffs: staffs
      });
    }

    // ✅ CASE B: Staff belongs to SUBSECTION of requested section
    const { rows: relation } = await db.query(
      `
      SELECT 1
      FROM section child
      WHERE child.id = $1
      AND child.parent_id = $2
      `,
      [staffSectionId, sectionId]
    );

    if (relation.length) {
      const { rows: ownSection } = await db.query(
        `SELECT * FROM section
         WHERE id=$1 AND is_deleted=false`,
        [staffSectionId]
      );

      return NextResponse.json({
        success: true,
        mode: "sub-section-staff",
        parent_section: section,
        own_section: ownSection[0]
      });
    }

    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 403 }
    );

  } catch (err) {
    console.error("Get section error:", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  const client = await db.connect();

  try {
    // 1️⃣ Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    const staff_id = auth.staff_id;

    // 2️⃣ Get section id
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    const sectionId = Number(idParam);

    if (!idParam || Number.isNaN(sectionId)) {
      return NextResponse.json(
        { success: false, message: "Valid id is required" },
        { status: 400 }
      );
    }

    // 3️⃣ Parse body
    const { name, parent_id, wait_default } = await req.json();

    if (
      name === undefined &&
      parent_id === undefined &&
      wait_default === undefined
    ) {
      return NextResponse.json(
        { success: false, message: "At least one field must be provided" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // ===============================
    // WAIT UPDATE (staff allowed)
    // ===============================
    let waitValue = undefined;

    if (wait_default !== undefined) {
      waitValue = Number(wait_default);

      if (Number.isNaN(waitValue) || waitValue < 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Invalid wait_default value" },
          { status: 400 }
        );
      }
    }

    // ===============================
    // STRUCTURE UPDATE (admin only)
    // ===============================
    let parent = undefined;
    let depth = undefined;

    if (name !== undefined || parent_id !== undefined) {

      if (!["admin", "super_admin"].includes(auth.role)) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Forbidden - admin only for structure change" },
          { status: 403 }
        );
      }

      if (name !== undefined && name.trim() === "") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Name cannot be empty" },
          { status: 400 }
        );
      }

      parent =
        parent_id !== undefined && parent_id !== null
          ? Number(parent_id)
          : null;

      if (parent !== null && Number.isNaN(parent)) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Invalid parent_id" },
          { status: 400 }
        );
      }

      // Prevent self-parent
      if (parent === sectionId) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Section cannot be its own parent" },
          { status: 400 }
        );
      }

      // Prevent circular reference
      if (parent !== null) {
        const cycleCheck = await client.query(
          `
          WITH RECURSIVE ancestors AS (
            SELECT id, parent_id
            FROM section
            WHERE id = $1
            UNION ALL
            SELECT s.id, s.parent_id
            FROM section s
            JOIN ancestors a ON s.id = a.parent_id
          )
          SELECT 1 FROM ancestors WHERE id = $2
          `,
          [parent, sectionId]
        );

        if (cycleCheck.rowCount > 0) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, message: "Circular reference detected" },
            { status: 400 }
          );
        }
      }

      // Calculate depth
      depth = 0;

      if (parent !== null) {
        const parentRow = await client.query(
          `SELECT depth_int
           FROM section
           WHERE id=$1 AND is_deleted=false`,
          [parent]
        );

        if (!parentRow.rowCount) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, message: "Parent section not found" },
            { status: 400 }
          );
        }

        depth = parentRow.rows[0].depth_int + 1;
      }

      // 🔥 Depth limit protection
      if (depth > 5) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Maximum depth exceeded (max 5)" },
          { status: 400 }
        );
      }
    }

    // ===============================
    // BUILD DYNAMIC UPDATE
    // ===============================
    const fields = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      fields.push(`name=$${index++}`);
      values.push(name.trim());
    }

    if (parent !== undefined) {
      fields.push(`parent_id=$${index++}`);
      values.push(parent);
      fields.push(`depth_int=$${index++}`);
      values.push(depth);
    }

    if (waitValue !== undefined) {
      fields.push(`wait_default=$${index++}`);
      values.push(waitValue);
      fields.push(`predict_time=$${index++}`);
      values.push(waitValue);
    }

    if (fields.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Nothing to update" },
        { status: 400 }
      );
    }

    values.push(sectionId);

    const result = await client.query(
      `UPDATE section
       SET ${fields.join(", ")}
       WHERE id=$${index}
       AND is_deleted=false
       RETURNING *`,
      values
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Section not found" },
        { status: 404 }
      );
    }

    // Recalculate subtree depth
    if (parent !== undefined) {
      await client.query(
        `
        WITH RECURSIVE subtree AS (
          SELECT id, parent_id
          FROM section
          WHERE id = $1
          UNION ALL
          SELECT s.id, s.parent_id
          FROM section s
          JOIN subtree st ON s.parent_id = st.id
        )
        UPDATE section s
        SET depth_int = (
          SELECT p.depth_int + 1
          FROM section p
          WHERE p.id = s.parent_id
        )
        WHERE s.id IN (
          SELECT id FROM subtree WHERE id != $1
        )
        `,
        [sectionId]
      );
    }

    // Log
    await client.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", `Updated section ${sectionId}`, "section"]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );

  } catch (err) {
    console.error("Update section error:", err);
    try { await client.query("ROLLBACK"); } catch {}
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
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
        { success: false, message: "Forbidden - admin only" },
        { status: 403 }
      );
    }
    
    const staff_id = auth.staff_id;

    const { rows: adminRows } = await client.query(
      `SELECT section_id
      FROM staff
      WHERE id = $1
        AND is_deleted = false`,
      [staff_id]
    );

    if (!adminRows.length) {
      return NextResponse.json(
        { success: false, message: "admin not found" },
        { status: 404 }
      );
    }

    const adminSectionId = adminRows[0].section_id;

    if (adminSectionId !== sectionId) {
      return NextResponse.json(
        { success: false, message: "you are not admin of this section" },
        { status: 403 }
      );
    }

    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id || isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "valid id is required" },
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
        { success: false, message: "Not found" },
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
    return NextResponse.json({ 
      success: true,
      message: "deleted" 
    });
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {}
    return NextResponse.json({ success: false, message: "Error" }, { status: 500 });
  } finally {
    client.release();
  }
}