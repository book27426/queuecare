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
      let decoded;

      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch (err) {
        return json({ success: false, message: "Invalid token" }, 401, origin);
      }

      const { uid, email, name } = decoded;
      const [first_name, ...rest] = (name || "").split(" ");
      const last_name = rest.join(" ");
      let status = "login";
      const client = await db.connect();

      try {
        await client.query("BEGIN");

        const existing = await client.query(
          `SELECT id, is_deleted FROM staff WHERE uid=$1`,
          [uid]
        );

        let result;
        let statusCode = 200;

        if (existing.rows.length > 0) {
          const staff = existing.rows[0];

          if (staff.is_deleted) {
            result = await client.query(
              `UPDATE staff SET is_deleted=false WHERE uid=$1 RETURNING *`,
              [uid]
            );
          } else {
            result = await client.query(
              `SELECT * FROM staff WHERE uid=$1`,
              [uid]
            );
          }
        } else {
          result = await client.query(
            `INSERT INTO staff (first_name, last_name, uid, email)
            VALUES ($1,$2,$3,$4)
            RETURNING *`,
            [first_name, last_name, uid, email]
          );

          statusCode = 201;
          status = "create";
        }

        await client.query("COMMIT");

        const expiresIn = 60 * 60 * 24 * 5 * 1000;

        const sessionCookie = await admin
          .auth()
          .createSessionCookie(idToken, { expiresIn });

        const response = NextResponse.json(
          { success: true, status: status, data: result.rows[0] },
          { status: statusCode }
        );

        response.cookies.set("session", sessionCookie, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: expiresIn / 1000,
          path: "/",
        });

        return withCors(response, origin);

      } catch (err) {
        await client.query("ROLLBACK");

        return json({ success: false, message: "error creating staff" }, 500, origin);

      } finally {
        client.release();
      }

    } catch (error) {
      return json({ message: "Internal Server Error" }, 500, origin);
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
        `SELECT s.id, s.first_name, s.last_name, s.email 
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
          RETURNING role, section_id`,
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
        
        return json({ success: true, data: result.rows[0] }, 200, origin);
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
        RETURNING id, first_name, last_name, section_id`,
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

      return json({ success: true, data: result.rows[0] }, 200, origin);
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
      const idParam = searchParams.get("id");
      const id = Number(idParam);

      const auth = await verifyStaff(req);
      if (auth.error)return withCors(auth.error, origin);

      if (!id || Number.isNaN(id)) {
        // const response = NextResponse.json(
        //   { success: true, status: "logout"},
        //   { status: 200 }
        // );

        // response.cookies.set("session", "", {
        //   httpOnly: true,
        //   secure: true,
        //   sameSite: "none",
        //   maxAge: 0,
        //   path: "/",
        // });

        // return withCors(response, origin);
        return json({ "success": false, message: "id is required" }, 400, origin);
      }


      if (!auth.isSuperAdmin)
        return json({ success: false, message: "Forbidden - admin only" }, 403, origin);

      await client.query("BEGIN");

      // 3. Soft delete
      const { rowCount } = await client.query(
        `UPDATE staff SET is_deleted=true WHERE id=$1 AND is_deleted=false`,
        [id]
      );

      if (!rowCount) {
        await client.query("ROLLBACK");
        return json({ "success": false, message: "Not found" }, 404, origin);
      }

      // 4. Insert log
      const detail = `Deleted staff ${id}`;
      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, "delete", detail, "staff"]
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
