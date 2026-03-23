import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
import { withTimer } from "@/lib/timer";
import crypto from "crypto";

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

export async function PUT(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();

  return withTimer(async () => {
    try {
      // 1️. Get section id
      const { searchParams} = new URL(req.url);
      const idParam = searchParams.get("id");
      const sectionId = Number(idParam);

      if (!sectionId) return json({ success: false, message: "section_id is required" }, 400, origin);

      // 2. Verify staff
      const auth = await verifyStaff(req, sectionId);
      if (auth.error) return withCors(auth.error, origin);
      
      if (!auth.isAdmin && !auth.isSuperAdmin) {
        return json({ success: false, message: "Forbidden - admin only" }, 403, origin);
      }

      const staff_id = auth.staff_id;

      // 2. Get request body
      const body = await req.json();
      const expire_minutes = body?.expire_minutes ?? 30;

      if (expire_minutes <= 0) {
        return json({ success: false, message: "expire_minutes must be positive" }, 400, origin);
      }

      const expiresAt = new Date(Date.now() + expire_minutes * 60000);
      const inviteCode = crypto.randomBytes(3).toString("hex");

      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE section
        SET invite_code = $1,
            code_expires_at = $2
        WHERE id = $3
          AND is_deleted = false
        RETURNING id, invite_code, code_expires_at
        `,
        [inviteCode, expiresAt, sectionId]
      );

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return json({ success: false, message: "Section not found" }, 404, origin);
      }

      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, "update", `Generate invite_code${inviteCode} section ${sectionId}`, "section"]
      );

      await client.query("COMMIT");

      return json({ success: true, data: {invite_code:inviteCode}}, 200, origin);

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

// GET /api/v1/sections/:id/live
export async function GET(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    const { searchParams} = new URL(req.url);
    const id = searchParams.get("id");
    const auth = await verifyStaff(req);
    const sectionId = Number(id);
    const roleSectionIds = auth.roles?.map(r => r.section_id) || [];

    const liveQuery = `
      WITH RECURSIVE subtree AS (
          SELECT id FROM section WHERE id = $1 AND is_deleted = false
          UNION ALL
          SELECT s.id FROM section s JOIN subtree st ON s.parent_id = st.id WHERE s.is_deleted = false
      ),
      allowed_ids AS (SELECT id FROM subtree WHERE id = ANY($2) OR $3 = true)
      SELECT 
        (SELECT json_agg(c) FROM (
            SELECT id, name, section_id, 
            EXISTS (SELECT 1 FROM staff_role sr WHERE sr.counter_id = counter.id) as is_active 
            FROM counter WHERE section_id = ANY(SELECT id FROM allowed_ids) AND is_deleted = false
        ) c) as counters,
        (SELECT json_agg(q) FROM (
            SELECT id, number, name, status FROM queue 
            WHERE section_id = ANY(SELECT id FROM allowed_ids) AND status = 'waiting'
        ) q) as queues,
        (SELECT row_to_json(stats) FROM (
            SELECT 
              AVG(EXTRACT(EPOCH FROM (end_at - start_at)) / 60) FILTER (WHERE status IN ('complete','transfer')) as avg_op,
              COUNT(*) FILTER (WHERE status != 'cancel' AND created_at >= CURRENT_DATE) as total_new,
              COUNT(*) FILTER (WHERE status IN ('complete','transfer') AND created_at >= CURRENT_DATE) as total_complete
            FROM queue WHERE section_id = ANY(SELECT id FROM allowed_ids)
        ) stats) as raw_stats;
    `;

    const { rows } = await db.query(liveQuery, [sectionId, roleSectionIds, auth.isSuperAdmin]);
    const result = rows[0];

    // Process stats for the frontend
    const now = new Date();
    const hoursPassed = Math.max(now.getHours() - 8, 1);
    const rawStats = result.raw_stats || {};

    return json({
      success: true,
      data: {
        counters: result.counters || [],
        queues: result.queues || [],
        stats: {
          avg_wait: Number(rawStats.avg_op) || 0,
          total_today: rawStats.total_new || 0,
          load_per_hour: (rawStats.total_new || 0) / hoursPassed
        }
      }
    }, 200, origin);
  }, req, origin);
}