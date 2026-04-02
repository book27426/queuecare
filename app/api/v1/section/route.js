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
    try {
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
        VALUES ($1,$2,$3)`,
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

      return json({ success: true }, 201, origin);

    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {}

      console.error(err);
      return json({ success: false, message: "internal server error" }, 500, origin);
    } finally {
      client.release();
    }
  }, req, origin);
}

export async function GET(req) {
  const origin = req.headers.get("origin");
  // return withTimer(async () => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const searchName = searchParams.get("name") ?? "";

    const auth = await verifyStaff(req);

    if (!id) {
      // Public Search (Non-authenticated or Unauthorized)
      if (auth.error) {
        const isNumber = !isNaN(searchName) && !isNaN(parseFloat(searchName));
        const { rows } = await db.query(
          `SELECT 
              id, 
              name,
              (SELECT COUNT(*)::int 
              FROM queue q 
              WHERE q.section_id = section.id 
              AND q.status IN ('waiting')
              AND q.created_at >= CURRENT_DATE
              ) as queue_count,
              (SELECT COUNT(*) * section.predict_time 
              FROM queue q 
              WHERE q.section_id = section.id 
              AND q.status IN ('waiting')
              AND q.created_at >= CURRENT_DATE
              ) as estimated_wait_minutes
            FROM section
            WHERE (
              name ILIKE '%' || $1 || '%' 
              OR ($2 = true AND id::text = $1)
            )
            AND is_deleted = false 
            AND depth_int = 0`,
          [searchName, isNumber]
        );

        return json({ success: true, mode: "public-search", data: rows }, 200, origin);
      }

      const rolesArray = Object.entries(auth.roles).map(([id, role]) => ({
        section_id: parseInt(id),
        role: role
      }));

      const { rows } = await db.query(
        `SELECT 
          s.id, 
          s.name, 
          r.role
        FROM section s
        JOIN jsonb_to_recordset($2::jsonb) AS r(section_id int, role text) 
          ON s.id = r.section_id
        WHERE s.name ILIKE '%' || $1 || '%'
          AND s.is_deleted = false`,
        [searchName, JSON.stringify(rolesArray)]
      );
      
      return json({ success: true, mode: "staff-search", data: rows }, 200, origin);
    }

    // DETAIL MODE
    if (auth.error) return withCors(auth.error, origin);
    const sectionId = Number(id);
    const roleSectionIds = auth.roles?.map(r => r.section_id) || [];

    
    const query = `
    SELECT 
      (SELECT row_to_json(s) FROM (SELECT * FROM section WHERE id = $1 AND is_deleted = false) s) as section,
      (SELECT json_agg(sub) FROM (
          SELECT id, name, parent_id FROM section 
          WHERE parent_id = $1 AND is_deleted = false
      ) sub) as sub_sections;
  `;

    const { rows } = await db.query(query, [sectionId]);
    const result = rows[0];

    if (!result.section) return json({ success: false, message: "Not found" }, 404);

    return json({
      success: true,
      data: {
        section: result.section,
        role: auth.roles?.find(r => r.section_id === sectionId).role || null,
        sub_sections: (result.sub_sections || []).map(sec => ({
          ...sec,
          has_access: auth.isSuperAdmin || roleSectionIds.includes(sec.id)
        }))
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
        AND is_deleted=false`,
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

      return json({ success: true }, 200, origin);

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