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
      wait_default
    } = await req.json();

    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

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

export async function GET(req) {
  try {
    // 1. Get id params
    const { searchParams} = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");

    /// 2.check User search
    if (name) {
      /// 2.1  Verify User
      const userAuth = await verifyUser(req);
      if (userAuth.error) return userAuth.error;

      const { rows } = await db.query(
        `
        SELECT id, name, default_wait_time, predict_time
        FROM section
        WHERE name ILIKE '%' || $1 || '%'
        AND is_deleted = false
        `,
        [name]
      );

      return NextResponse.json({
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
        { message: "id is required" },
        { status: 400 }
      );
    }

    const sectionId = Number(id);

    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      return NextResponse.json(
        { message: "valid id is required" },
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
        { message: "Not found" },
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
        SELECT id, name
        FROM staff
        WHERE section_id = ANY($1)
          AND is_deleted = false
        ORDER BY name ASC
        `,
        [sectionIds]
      );

      // 1️⃣ Hourly breakdown
      const { rows: hourlyRows } = await db.query(
        `
        SELECT
          TO_CHAR(date_trunc('hour', created_at), 'HH24:00') AS hour,
          COUNT(*) FILTER (WHERE status != 'cancelled') AS new_queue,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed
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
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)
            AS avg_operation_minutes
        FROM queue
        WHERE section_id = $1
          AND status = 'completed'
          AND started_at IS NOT NULL
          AND completed_at IS NOT NULL
          AND completed_at >= CURRENT_DATE
        `,
        [sectionId]
      );

      // 3️⃣ Totals
      const { rows: totalRows } = await db.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE status != 'cancelled') AS total_new,
          COUNT(*) FILTER (WHERE status = 'completed') AS total_completed
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
          Number(totalRows[0].total_completed) / hoursPassed,

        est_avg_operation_time_per_case_minutes:
          Number(avgRows[0].avg_operation_minutes) || 0,

        hourly_breakdown: hourlyRows,

        last_updated: new Date().toISOString(),
      };

      return NextResponse.json({
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
        mode: "sub-section-staff",
        parent_section: section,
        own_section: ownSection[0]
      });
    }

    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 403 }
    );

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
    const { name, parent_id, wait_default} = await req.json();

    const sectionId = Number(id);
    const wait = Number(wait_default ?? 5);
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

    if (parent !== null) {
      const cycleCheck = await client.query(
        `
        WITH RECURSIVE tree AS (
          SELECT id, parent_id
          FROM section
          WHERE id = $1
          UNION ALL
          SELECT s.id, s.parent_id
          FROM section s
          INNER JOIN tree t ON s.id = t.parent_id
        )
        SELECT id FROM tree WHERE id = $2
        `,
        [parent, sectionId]
      );

      if (cycleCheck.rowCount > 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "circular reference detected" },
          { status: 400 }
        );
      }
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
    const result = await client.query(
      `UPDATE section
       SET name=$1, parent_id=$2, depth_int=$3,wait_default=$4 ,predict_time=$5
       WHERE id=$6 AND is_deleted=false RETURNING *`,
      [name, parent, depth, wait, wait, sectionId]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Not found" },
        { status: 404 }
      );
    }

    // 5️. Recalculate children depth
    await client.query(
      `
      WITH RECURSIVE subtree AS (
        SELECT id, parent_id, depth_int
        FROM section
        WHERE id = $1
        UNION ALL
        SELECT s.id, s.parent_id, s.depth_int
        FROM section s
        INNER JOIN subtree st ON s.parent_id = st.id
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

    /// 6. Insert log
    const detail = `Updated section ${sectionId}:name=${name}, parent=${parent}, depth=${depth}`;

    await client.query(
      `INSERT INTO log (staff_id, action_type, action,target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", detail, "section"]
    );

    await client.query("COMMIT");
    return NextResponse.json({ success: true,data: result.rows[0]}, { status: 201 });
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
