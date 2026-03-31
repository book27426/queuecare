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

  return withTimer(async () => {    
    try {
      // 2️. get body
      const formData = await req.formData();
      const name = formData.get("name");
      const section_id = Number(formData.get("section_id"));

      if (!name || !section_id || Number.isNaN(section_id)) 
        return json({ success: false, message: "Invalid body request: name and section_id required" }, 400, origin);
      
      // 3️. verify staff permission
      const auth = await verifyStaff(req, section_id);
      if (auth.error) return auth.error;

      if (!auth.isAdmin && !auth.isSuperAdmin) {
        return json({ success: false, message: "Admin permission required" }, 403, origin);
      }

      // 4️. insert counter
      const { rows } = await db.query(
        `INSERT INTO counter (name, section_id)
        VALUES ($1, $2)
        RETURNING id, name, section_id`,
        [name.trim().toUpperCase(), section_id]
      );

      return json({ success: true}, 201, origin);
      
    } catch (err) {
      if (err.code === "23505")
        return json({ success: false, message: "Counter already exists" }, 409, origin);

      console.error(err);
      return json({ success: false, message: "Internal Server Error" }, 500, origin);
    }
  }, req, origin);
}

export async function PUT(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    try {
      // 1️. get counter id
      const { searchParams } = new URL(req.url);
      const counter_id = Number(searchParams.get("id"));

      if (!counter_id || Number.isNaN(counter_id))
        return json({ success: false, message: "valid counter id required" }, 400, origin);

      // 2️. body
      const formData = await req.formData();
      const name = formData.get("name");

      if (!name)
        return json({ success: false, message: "name required" }, 400, origin);

      // 3️. get section of counter
      const counter = await db.query(
        `SELECT section_id FROM counter WHERE id = $1`,
        [counter_id]
      );

      if (counter.rowCount === 0)
        return json({ success: false, message: "Counter not found" }, 404, origin);

      const section_id = counter.rows[0].section_id;

      // 4️. verify permission
      const auth = await verifyStaff(req, section_id);
      if (auth.error) return auth.error;

      if (!auth.isAdmin && !auth.isSuperAdmin)
        return json({ success: false, message: "Admin permission required" }, 403, origin);

      // 5️. update counter
      const { rows } = await db.query(
        `UPDATE counter
        SET name = $1
        WHERE id = $2
        RETURNING id, name, section_id`,
        [name.trim().toUpperCase(), counter_id]
      );

      return json({ success: true }, 200, origin);

    } catch (err) {

      if (err.code === "23505")
        return json({ success: false, message: "Counter name already exists" }, 409, origin);

      console.error(err);

      return json({ success: false, message: "Server error" }, 500, origin);
    }
  }, req, origin);
}

export async function DELETE(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    try {
      const { searchParams } = new URL(req.url);
      const counter_id = Number(searchParams.get("id"));

      if (!counter_id || Number.isNaN(counter_id))
        return json({ success: false, message: "valid counter id required" }, 400, origin);

      // find section_id of counter
      const { rows } = await db.query(
        `SELECT section_id FROM counter WHERE id = $1 AND is_deleted = false`,
        [counter_id]
      );

      if (!rows.length) {
        return json(
            { success: false, message: "counter not found" },
            404,
            origin
        );
      }

      const section_id = rows[0].section_id;

      // verify admin
      const auth = await verifyStaff(req, section_id);
      if (auth.error) return withCors(auth.error, origin);

      if (!auth.isAdmin && !auth.isSuperAdmin) {
        return json(
            { success: false, message: "admin only" },
            403,
            origin
        );
      }

      // soft delete
      await db.query(
        `UPDATE counter
        SET is_deleted = true
        WHERE id = $1`,
        [counter_id]
      );

      return json({ success: true, message: "counter deleted" }, 200, origin);

    } catch (err) {
      console.error(err);
      return json(
        { success: false, message: "server error" },
        500,
        origin
      );
    }
  }, req, origin);
}

export async function GET(req) {
  const origin = req.headers.get("origin");

  return withTimer(async () => {
    try {
      const { searchParams } = new URL(req.url);
      const counter_id = Number(searchParams.get("id"));

      if (!counter_id || Number.isNaN(counter_id)) {
        return json({ success: false, message: "valid counter id required" }, 400, origin);
      }

      // 1. Start Auth and DB queries simultaneously
      const [auth, dbData] = await Promise.all([
        verifyStaff(req), // Pass the request; we'll check section_id permissions after we get it from the DB
        db.query(`
          WITH counter_info AS (
            SELECT id, name, section_id 
            FROM counter 
            WHERE id = $1 AND is_deleted = false
            LIMIT 1
          )
          SELECT 
            (SELECT row_to_json(c) FROM counter_info c) as counter,
            (SELECT json_agg(q) FROM (
              SELECT id, number, name, phone_num, start_at FROM queue 
              WHERE counter_id = $1 AND status = 'serving' AND queue_date = CURRENT_DATE 
              ORDER BY start_at ASC LIMIT 1
            ) q) as current_queue,
            (SELECT json_agg(nq) FROM (
              SELECT id, number FROM queue 
              WHERE section_id = (SELECT section_id FROM counter_info) 
              AND queue_date = CURRENT_DATE AND status = 'waiting' 
              ORDER BY id ASC LIMIT 1
            ) nq) as next_queues,
            (SELECT json_agg(s) FROM (
              SELECT id, name FROM section 
              WHERE parent_id = (SELECT section_id FROM counter_info) 
              ORDER BY id
            ) s) as section_access
        `, [counter_id])
      ]);

      const result = dbData.rows[0];

      // 2. Early exit if counter doesn't exist
      if (!result.counter) {
        return json({ success: false, message: "counter not found" }, 404, origin);
      }

      // 3. Authorization Check (Now that we have the section_id from the DB)
      if (auth.error) return auth.error;

      const isAuthorized = auth.isAdmin || auth.isSuperAdmin || 
                          (auth.counter_id === counter_id && auth.section_id === result.counter.section_id);

      if (!isAuthorized) {
        return json({ success: false, message: "Forbidden: access denied" }, 403, origin);
      }

      // 4. Return combined results
      return json({
        success: true,
        data: {
          counter: result.counter,
          section_access: result.section_access || [],
          current_queue: result.current_queue?.[0] || null,
          next_queues: result.next_queues || []
        }
      }, 200, origin);

    } catch (err) {
      console.error(err);
      return json({ success: false, message: "server error" }, 500, origin);
    }
  }, req, origin);
}