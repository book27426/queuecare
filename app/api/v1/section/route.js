import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
import { withTimer } from "@/lib/timer";

import { withCors, getCorsHeaders } from "@/lib/cors";

function json(data, status, origin) {
  return withCors(
    NextResponse.json(data, { status }),
    origin
  );
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin");

  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();
  return withTimer(async () => {
    // try {
      ///this take to long to run
      // 1. Verify staff
      const auth = await verifyStaff(req);
      if (auth.error)return withCors(auth.error, origin);
      
      const staff_id = auth.staff_id;
      // 2. Get request body
      const {
        name,
        parent_id
      } = await req.json();

      if (!name)
        return json({ success: false, message: "name is required" }, 400, origin);

      const parent = parent_id ? Number(parent_id) : null;

      await client.query("BEGIN");

      let depth = 0;

      if (parent) {
        const parentCheck = await client.query(
          `SELECT id, depth_int FROM section WHERE id=$1`,
          [parent]
        );

        if (!parentCheck.rowCount) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "parent section not found" },400 , origin);
        }

        depth = parentCheck.rows[0].depth_int + 1;
      }

      if (depth > 5) {
        await client.query("ROLLBACK");
        return json(
          { success: false, message: "maximum depth exceeded" }, 400, origin);
      }

      // 3. Insert section
      const section = await client.query(
        `INSERT INTO section 
          (name, parent_id, depth_int)
        VALUES ($1,$2,$3)
        RETURNING *`,
        [name, parent, depth]
      );

      await client.query(
        `INSERT INTO staff_role 
          (role, staff_id, section_id)
        VALUES ($1,$2,$3)`,
        ["admin", staff_id, section.rows[0].id]
      );

      const detail = `Created section ${section.rows[0].id} (${name})`;
      await client.query(
        `INSERT INTO log (staff_id, action_type,action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, "create",detail, "section"]
      );

      await client.query("COMMIT");

      return json({ success: true, data: section.rows[0] }, 201, origin);

    // } catch (err) {
    //   try {
    //     await client.query("ROLLBACK");
    //   } catch {}

    //   console.error(err);
    //   return json({ success: false, message: "internal server error" }, 500, origin);
    // } finally {
    //   client.release();
    // }
  }, req, origin);
}

export async function GET(req) {
  const origin = req.headers.get("origin");
  // return withTimer(async () => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const name = searchParams.get("name");

    const searchName = name ?? "";

    const auth = await verifyStaff(req);

    // =================================================
    // 🔎 SEARCH SECTION
    // =================================================
    if (!id) {
      // PUBLIC SEARCH
      if (auth.error) {

        const { rows } = await db.query(
          `
          SELECT id, name, wait_default, predict_time
          FROM section
          WHERE name ILIKE '%' || $1 || '%'
          AND is_deleted = false
          AND depth_int = 0
          `,
          [searchName]
        );

        return json({
          success: true,
          mode: "public-search",
          data: rows
        }, 200, origin);
      }

      const sectionIds = auth.roles.map(r => r.section_id);

      const { rows } = await db.query(
        `
        SELECT id, name
        FROM section
        WHERE name ILIKE '%' || $1 || '%'
        AND is_deleted = false
        AND id = ANY($2)
        `,
        [searchName, sectionIds]
      );

      return json({
        success: true,
        mode: "staff-search",
        data: rows
      }, 200, origin);
    }

    // =================================================
    // 📌 SECTION DETAIL
    // =================================================

    if (auth.error) return withCors(auth.error, origin);

    const sectionId = Number(id);

    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      return json({ success: false, message: "valid id is required" }, 400, origin);
    }

    const roleSectionIds = auth.roles?.map(r => r.section_id) || [];
    // =================================================
    // GET SECTION
    // =================================================

    const { rows: sectionRows } = await db.query(
      `
      SELECT *
      FROM section
      WHERE id=$1
      AND is_deleted=false
      `,
      [sectionId]
    );

    if (!sectionRows.length) {
      return json({ success: false, message: "Not found" }, 404, origin);
    }

    const section = sectionRows[0];

    // =================================================
    // GET SUBTREE (permission check)
    // =================================================

    const { rows: subtreeRows } = await db.query(
      `
      WITH RECURSIVE subtree AS (
        SELECT id
        FROM section
        WHERE id = $1

        UNION ALL

        SELECT s.id
        FROM section s
        JOIN subtree st ON s.parent_id = st.id
      )
      SELECT id FROM subtree
      `,
      [sectionId]
    );

    const subtreeIds = subtreeRows.map(r => r.id);

    const hasDirectAccess = roleSectionIds.includes(sectionId);

    const allowedSubSections = roleSectionIds.filter(id =>
      subtreeIds.includes(id)
    );

    const hasSubAccess = allowedSubSections.length > 0;

    if (!auth.isSuperAdmin && !hasDirectAccess && !hasSubAccess) {
      return json({ success: false, message: "Forbidden" }, 403, origin);
    }

    const fullAccess = auth.isSuperAdmin || hasDirectAccess;

    const allowedSectionIds = fullAccess
      ? [sectionId]
      : allowedSubSections;

    // =================================================
    // SUB SECTIONS
    // =================================================

    const { rows: subSectionsRaw } = await db.query(
      `
      SELECT id, name, parent_id
      FROM section
      WHERE parent_id = $1
      AND is_deleted=false
      `,
      [sectionId]
    );

    const subSections = subSectionsRaw.map(sec => {

      let hasAccess = false;

      if (auth.isSuperAdmin || fullAccess) {
        hasAccess = true;
      } else {
        hasAccess = roleSectionIds.includes(sec.id);
      }

      return {
        ...sec,
        has_access: hasAccess
      };
    });
    
    // =================================================
    // QUEUES
    // =================================================

    const { rows: queues } = await db.query(
      `
      SELECT *
      FROM queue
      WHERE section_id = ANY($1)
      AND status='waiting'
      `,
      [allowedSectionIds]
    );

    // =================================================
    // STAFF
    // =================================================

    const { rows: staffs } = await db.query(
      `
      SELECT s.id, s.first_name, s.last_name, sr.section_id
      FROM staff s
      JOIN staff_role sr ON sr.staff_id = s.id
      WHERE sr.section_id = ANY($1)
      AND s.is_deleted = false
      ORDER BY s.first_name ASC
      `,
      [allowedSectionIds]
    );

    // =================================================
    // COUNTERS
    // =================================================

    const { rows: counters } = await db.query(
      `
      SELECT id, name, section_id
      FROM counter
      WHERE section_id = ANY($1)
      ORDER BY name ASC
      `,
      [allowedSectionIds]
    );

    // =================================================
    // HOURLY STATS
    // =================================================

    const { rows: hourlyRows } = await db.query(
      `
      SELECT
        TO_CHAR(date_trunc('hour', created_at), 'HH24:00') AS hour,
        COUNT(*) FILTER (WHERE status != 'cancel') AS new_queue,
        COUNT(*) FILTER (WHERE status IN ('complete','transfer')) AS complete
      FROM queue
      WHERE section_id = ANY($1)
      AND created_at >= CURRENT_DATE
      GROUP BY 1
      ORDER BY 1
      `,
      [allowedSectionIds]
    );

    const { rows: avgRows } = await db.query(
      `
      SELECT
        AVG(EXTRACT(EPOCH FROM (end_at - start_at)) / 60)
        AS avg_operation_minutes
      FROM queue
      WHERE section_id = ANY($1)
      AND status IN ('complete','transfer')
      AND start_at IS NOT NULL
      AND end_at IS NOT NULL
      AND end_at >= CURRENT_DATE
      `,
      [allowedSectionIds]
    );

    const { rows: totalRows } = await db.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancel') AS total_new,
        COUNT(*) FILTER (WHERE status IN ('complete','transfer')) AS total_complete
      FROM queue
      WHERE section_id = ANY($1)
      AND created_at >= CURRENT_DATE
      `,
      [allowedSectionIds]
    );

    const now = new Date();
    const hoursPassed = Math.max(now.getHours() - 8, 1);

    const stats = {
      est_new_queue_per_hour:
        Number(totalRows[0]?.total_new || 0) / hoursPassed,

      est_complete_case_per_hour:
        Number(totalRows[0]?.total_complete || 0) / hoursPassed,

      est_avg_operation_time_per_case_minutes:
        Number(avgRows[0]?.avg_operation_minutes) || 0,

      hourly_breakdown: hourlyRows,

      last_updated: new Date().toISOString()
    };

    return json({
      success: true,
      mode: "section-detail",
      access: fullAccess ? "full" : "partial",
      data: {
        section,
        sub_sections: subSections,
        counters,
        queues,
        staffs,
        stats
      }
    }, 200, origin);
  // }, req, origin);
}

export async function PUT(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();
  return withTimer(async () => {
    try {
      // 2️. Get section id
      const { searchParams } = new URL(req.url);
      const idParam = searchParams.get("id");
      const sectionId = Number(idParam);

      // 1️. Verify staff
      const auth = await verifyStaff(req,sectionId);
      if (auth.error)return withCors(auth.error, origin);

      const staff_id = auth.staff_id;

      if (!idParam || Number.isNaN(sectionId))
        return json({ success: false }, 400, origin);

      // 3️. Parse body
      const { name, parent_id, wait_default } = await req.json();

      if (
        name === undefined &&
        parent_id === undefined &&
        wait_default === undefined
      ) {
        return json({ success: false, message: "At least one field must be provided" }, 400, origin);
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
          return json({ success: false, message: "Invalid wait_default value" }, 400, origin);
        }
      }

      // ===============================
      // STRUCTURE UPDATE (admin only)
      // ===============================
      let parent = undefined;
      let depth = undefined;

      if (name !== undefined || parent_id !== undefined) {

        if (!auth.isAdmin && !auth.isSuperAdmin) {
          await client.query("ROLLBACK");
          return json(
            { success: false, message: "Forbidden - admin only for structure change" },
            403,
            origin
          );
        }

        if (name !== undefined && name.trim() === "") {
          await client.query("ROLLBACK");
          return json({ success: false, message: "Name cannot be empty" }, 400, origin);
        }

        parent =
          parent_id !== undefined && parent_id !== null
            ? Number(parent_id)
            : null;

        if (parent !== null && Number.isNaN(parent)) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "Invalid parent_id" }, 400, origin);
        }

        // Prevent self-parent
        if (parent === sectionId) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "Section cannot be its own parent" }, 400, origin);
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
            return json({ success: false, message: "Circular reference detected" }, 400, origin);
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
            return json({ success: false, message: "Parent section not found" }, 400, origin);
          }

          depth = parentRow.rows[0].depth_int + 1;
        }

        // 🔥 Depth limit protection
        if (depth > 5) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "Maximum depth exceeded (max 5)" }, 400, origin);
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
        return json({ success: false, message: "Nothing to update" }, 400, origin);
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
        return json({ success: false, message: "Section not found" }, 404, origin);
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

      return json({ success: true, data: result.rows[0] }, 200, origin);

    } catch (err) {
      console.error("Update section error:", err);
      try { await client.query("ROLLBACK"); } catch {}
      return json({ success: false, message: "Internal Server Error" }, 400, origin);
    } finally {
      client.release();
    }
  }, req, origin);
}

export async function DELETE(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();
  return withTimer(async () => {
    try {
      // 1️. Get section id
      const { searchParams } = new URL(req.url);
      const idParam = searchParams.get("id");
      const sectionId = Number(idParam);

      if (!sectionId || isNaN(sectionId)) {
        return json({ success: false, message: "valid id is required" }, 400, origin);
      }

      // 2️. Verify staff WITH section permission
      const auth = await verifyStaff(req, sectionId);
      if (auth.error) return withCors(auth.error, origin);

      if (!auth.isAdmin && !auth.isSuperAdmin) {
        return json({ success: false, message: "Forbidden - admin only" }, 403, origin);
      }

      const staff_id = auth.staff_id;

      await client.query("BEGIN");

      // 3️. Soft delete
      const { rowCount } = await client.query(
        `UPDATE section
        SET is_deleted = true
        WHERE id = $1
        AND is_deleted = false`,
        [sectionId]
      );

      if (!rowCount) {
        await client.query("ROLLBACK");
        return json({ success: false, message: "Not found" }, 404, origin);
      }

      // 4️. Insert log
      const detail = `section_id = ${sectionId}`;

      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, "delete", detail, "section"]
      );

      await client.query("COMMIT");

      return json({ success: true, message: "deleted" }, 200, origin);

    } catch (err) {

      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error("DELETE section error:", err);

      return json({ success: false, message: "Error" }, 500, origin);

    } finally {
      client.release();
    }
  }, req, origin);
}