import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff } from "@/lib/auth";
import { withTimer } from "@/lib/timer";
import admin from "@/lib/firebaseAdmin";

import { withCors, getCorsHeaders } from "@/lib/cors";

export async function OPTIONS(req) {
  const origin = req.headers.get("origin");

  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

function json(data, status, origin) {
  return withCors(
    NextResponse.json(data, { status }),
    origin
  );
}

export async function POST(req) {
  const origin = req.headers.get("origin");

  return withTimer(async () => {
    try {
      const authHeader = req.headers.get("authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return json({ success: false, message: "Unauthorized" }, 401, origin);
      }

      const idToken = authHeader.split("Bearer ")[1];
      
      const expiresIn = 60 * 60 * 24 * 5 * 1000;
      const [decoded, sessionCookie] = await Promise.all([
        admin.auth().verifyIdToken(idToken),
        admin.auth().createSessionCookie(idToken, { expiresIn })
      ]);

      const { uid, email, name, picture } = decoded;
      const [first_name, ...rest] = (name || "").split(" ");
      const last_name = rest.join(" ");

      const upsertQuery = `
        INSERT INTO staff (uid, first_name, last_name, email, image, is_deleted)
        VALUES ($1, $2, $3, $4, $5, false)
        ON CONFLICT (uid) 
        DO UPDATE SET 
          is_deleted = false,
          image = EXCLUDED.image,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name
      `;

      const result = await db.query(upsertQuery, [uid, first_name, last_name, email, picture]);
      
      const response = NextResponse.json(
        { success: true },
        { status: 200 }
      );

      response.cookies.set("session", sessionCookie, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: expiresIn / 1000,
        path: "/",
      });

      return withCors(response, origin);

    } catch (error) {
      console.error("Auth Error:", error);
      return json({ success: false, message: "Authentication failed" }, 500, origin);
    }
  }, req, origin);
}

export async function GET(req) {
  const origin = req.headers.get("origin");

  return withTimer(async () => {
    try {
      const { searchParams } = new URL(req.url);
      const section_id = searchParams.get("id");
      
      if (!section_id) {
        return json({ success: false, message: "id is required" }, 400, origin);
      }

      const auth = await verifyStaff(req,section_id);
      if (auth.error) return withCors(auth.error, origin);

      const { rows } = await db.query(
        `SELECT s.id, s.first_name, s.last_name, s.email, sr.role 
         FROM staff s
         JOIN staff_role sr ON s.id = sr.staff_id
         WHERE sr.section_id = $1 
           AND s.is_deleted = false`,
        [section_id]
      );

      if (rows.length === 0) {
        return json({ success: false, message: "No staff found for this section" }, 404, origin);
      }

      return json({ success: true, data: rows }, 200, origin);

    } catch (error) {
      console.error("API Route Error:", error); // Essential for debugging
      return json({ success: false, message: "Internal Server Error" }, 500, origin);
    }
  }, req, origin);
}

export async function PUT(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();

  return withTimer(async () => {
    try {
      const auth = await verifyStaff(req);
      if (auth.error) return withCors(auth.error, origin);

      const { staff_id: authId } = auth;

      const { searchParams } = new URL(req.url);
      const idParam = searchParams.get("id");
      const id = idParam ? Number(idParam) : authId; 
      // if no id provided → edit self

      if (!Number.isInteger(id)) {
        return json({ success: false, message: "valid id is required" }, 400, origin);
      }

      const body = await req.json();

      // =================================================
      // 👤 NORMAL STAFF
      // =================================================
        // 1️⃣ If using invite code
      if (body.invite_code && (body.first_name || body.last_name)) {
        return json(
          { success: false, message: "invite_code cannot be combined with profile update" },
          400,
          origin
        );
      }

      if (body.invite_code) {
        await client.query("BEGIN");

        const { rows } = await client.query(
          `SELECT id
          FROM section
          WHERE invite_code = $1
            AND code_expires_at >= NOW()
            AND is_deleted = false`,
          [body.invite_code]
        );

        if (!rows.length) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "invalid or expired invite code" }, 400, origin);
        }

        const section_id = rows[0].id;

        const result = await client.query(
          `INSERT INTO staff_role (role, staff_id, section_id)
          VALUES ($1,$2,$3)
          ON CONFLICT (staff_id, section_id, role) DO NOTHING
          `,
          ["staff", authId, section_id]
        );

        if (result.rowCount === 0) {
          await client.query("ROLLBACK");
          return json(
            { success: false, message: "already joined this section" },
            400,
            origin
          );
        }

        await client.query(
          `INSERT INTO log (staff_id, action_type, action, target)
          VALUES ($1, $2, $3, $4)`,
          [
            authId,
            "update",
            `Joined section ${section_id} using invite code`,
            "staff"
          ]
        );

        await client.query("COMMIT");
        
        return json({ success: true }, 200, origin);
      }

      // 2️⃣ Self profile update
      if (id !== authId) {
        return json({ success: false, message: "cannot modify other staff" }, 403, origin);
      }
      
      const { first_name, last_name } = body;
      
      if (!first_name && !last_name)
        return json({ success: false, message: "No fields to update" }, 400, origin);

      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE staff
        SET
          first_name = COALESCE($1, first_name),
          last_name  = COALESCE($2, last_name)
        WHERE id=$3
        `,
        [first_name, last_name, authId]
      );

      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [
          authId,
          "update",
          `Staff ${authId} updated profile`,
          "staff"
        ]
      );

      await client.query("COMMIT");

      return json({ success: true }, 200, origin);
      // =================================================
      // 👑 ADMIN / SUPER_ADMIN
      // =================================================

      // const { first_name, last_name, role, section_id } = body;

      // await client.query("BEGIN");

      // if (section_id !== undefined) {

      //   if (!Number.isInteger(section_id)) {
      //     await client.query("ROLLBACK");
      //     return json({ success: false, message: "invalid section_id" }, 400, origin);

      //   }

      //   const { rows: sectionRows } = await client.query(
      //     `SELECT id
      //     FROM section
      //     WHERE id = $1
      //       AND is_deleted = false`,
      //     [section_id]
      //   );

      //   if (!sectionRows.length) {
      //     await client.query("ROLLBACK");
      //     return json({ success: false, message: "section not found" }, 404, origin);
      //   }
      // }
    
      // const { rows: targetRows } = await client.query(
      //   `SELECT role FROM staff_role WHERE staff_id=$1`
      // );

      // if (!targetRows.length) {
      //   await client.query("ROLLBACK");
      //   return json({ success: false, message: "Not found" }, 404, origin);
      // }

      // const targetRole = targetRows[0].role;

      // if (targetRole === "super_admin" && authRole !== "super_admin") {
      //   await client.query("ROLLBACK");
      //   return json(
      //     { success: false, message: "cannot modify super_admin" }, 403, origin);
      // }

      // const result = await client.query(
      //   `UPDATE staff
      //    SET
      //      first_name = COALESCE($1, first_name),
      //      last_name  = COALESCE($2, last_name)
      //    WHERE id=$5
      //    RETURNING *`,
      //   [first_name, last_name, role, section_id, id]
      // );

      // await client.query(
      //   `UPDATE staff_role
      //   SET role = COALESCE($1, role)
      //   WHERE staff_id=$2 AND section_id=$3`,
      //   [role, id, section_id]
      // );

      // await client.query("COMMIT");

      // return json({ success: true, data: result.rows[0] }, 200, origin);
    } catch (err) {
      console.error("Update staff error:", err);
      try { await client.query("ROLLBACK"); } catch {}
      return json({ success: false, message: "error" }, 500, origin);
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
      // 1. Get id params
      const { searchParams } = new URL(req.url);
      const idParam = searchParams.get("staff_id");
      const sectionID = searchParams.get("id");
      const id = Number(idParam);
      const section_id = Number(sectionID);
      if (!id || !section_id) {
        return json({ success: false, message: "staff_id and section_id is required" }, 400, origin);
      }
      const auth = await verifyStaff(req, section_id);
      if (auth.error)return withCors(auth.error, origin);

      if (!auth.isSuperAdmin || !auth.isAdmin)
        return json({ success: false, message: "Forbidden - admin only" }, 403, origin);

      await client.query("BEGIN");

      // 3. Soft delete
      const { rowCount } = await client.query(
        `DELETE staff_role WHERE staff_id=$1 AND section_id=$2`,
        [id, section_id]
      );

      if (!rowCount) {
        await client.query("ROLLBACK");
        return json({ "success": false, message: "Not found" }, 404, origin);
      }

      // 4. Insert log
      const detail = `remove staff ${id} from section ${section_id}`;
      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [auth.staff_id, "remove", detail, "staff"]
      );

      await client.query("COMMIT");

      return json({success: true, message: "deleted" }, 200, origin);
    } catch (err) {
      console.error("DELETE staff error:", err);
      try {
        await client.query("ROLLBACK");
      } catch {}
      return json({ "success": false, message: "error" }, 500, origin);
    } finally {
      client.release();
    }
  }, req, origin);
}
