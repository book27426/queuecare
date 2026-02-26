import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
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

  try {
    // 2. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error)return withCors(auth.error, origin);

    if (!["admin", "super_admin"].includes(auth.role)) {
      return json( { success: false, message: "Admin only" }, 403, origin);
    }
    
    const staff_id = auth.staff_id;
    // 1️. Get section id
    const { searchParams} = new URL(req.url);
    const idParam = searchParams.get("id");
    const sectionId = Number(idParam);

    if (!sectionId) return json({ success: false, message: "section_id is required" }, 400, origin);

    const { rows: adminRows } = await client.query(
      `SELECT section_id
      FROM staff
      WHERE id = $1
        AND is_deleted = false`,
      [staff_id]
    );

    if (!adminRows.length)
      return json({ success: false, message: "admin not found" }, 404, origin);

    const adminSectionId = adminRows[0].section_id;

    if (adminSectionId !== sectionId)
      return json({ success: false, message: "you are not admin of this section" }, 403, origin);

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
}