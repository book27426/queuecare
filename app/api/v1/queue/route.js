import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff, verifyUser } from "@/lib/auth";
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

export async function POST(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();
  return withTimer(async () => {
    try {
      // 1. Verify user
      const auth = await verifyUser(req);
      const user_id = auth?.error ? null : auth.user_id;
      
      // 2. Get request body
      let { section_id, name, phone_num } = await req.json();
      section_id = Number(section_id);

      if (
        !Number.isInteger(section_id) ||
        section_id <= 0 ||
        !name ||
        !phone_num
      )return json({ success: false, message: "invalid body" }, 400, origin);

      await client.query("BEGIN");

      const sectionRes = await client.query(
        `SELECT wait_default FROM section WHERE id = $1 AND is_deleted = false FOR UPDATE`,
        [section_id]
      );

      if (!sectionRes.rowCount) throw new Error("404");
      const { wait_default } = sectionRes.rows[0];

      // 3. generate number
      const lastQueue = await client.query(
        `SELECT number FROM queue 
         WHERE section_id = $1 AND queue_date = CURRENT_DATE 
         ORDER BY id DESC LIMIT 1`,
        [section_id]
      );

      let number = "001";
      if (lastQueue.rows.length > 0) {
        number = String(parseInt(lastQueue.rows[0].number, 10) + 1).padStart(3, "0");
      }
      // 4. Generate guest_token
      let guest_token = null;
      let needSetCookie = false;

      if (user_id === null) {
        guest_token  = req.cookies.get("guest_token")?.value;
        if(!guest_token){
          guest_token = crypto.randomUUID();
          needSetCookie = true;
        }
      }
      
      // 5. Insert section
      const queueInsert = await client.query(
        `INSERT INTO queue (number, name, phone_num, user_id, section_id, token)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [number, name, phone_num, user_id, section_id, guest_token]
      );

      const newId = queueInsert.rows[0].id;
      // 6. Calculate Prediction (Virtual)
      // Count people ahead of this record that are still 'waiting'
      const waitQuery = await client.query(
        `SELECT COUNT(*) as count FROM queue 
         WHERE section_id = $1 AND queue_date = CURRENT_DATE 
         AND status = 'waiting' AND id < $2`,
        [section_id, newId]
      );

      await client.query("COMMIT");
      

      // 7. Insert log
      if (user_id) {
        db.query(`INSERT INTO log (user_id, action_type, target) VALUES ($1, 'create', 'queue')`, [user_id])
          .catch(err => console.error("Log error:", err));
      }

      const people_ahead = parseInt(waitQuery.rows[0].count);
      const response = NextResponse.json({ 
        success: true, 
        data: { ...queueInsert.rows[0], people_ahead, predicted_wait_minutes: people_ahead * wait_default }
      }, { status: 201 });

      if(needSetCookie){
        response.cookies.set("guest_token", guest_token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 60 * 60 * 24 * 30, // 30 days,
          path: "/",
        });
      }

      return withCors(response, origin);
      
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
};

export async function GET(req) {
  const origin = req.headers.get("origin");
  return withTimer(async () => {
    try {
      const guest_token  = req.cookies.get("guest_token")?.value;
      // 🧑‍💼 STAFF VIEW
      const { searchParams } = new URL(req.url);
      const section_id = Number(searchParams.get("id"));

      const staffAuth = await verifyStaff(req,section_id);
      if (!staffAuth.error) {
        const { rows } = await db.query(
          `SELECT q.id, q.number, c.name AS counter_name, q.status
          FROM queue q
          LEFT JOIN staff_role sr ON sr.staff_id = q.staff_id  
          LEFT JOIN counter c ON c.id = sr.counter_id  
          WHERE q.section_id = $1
            AND q.status IN ('waiting', 'serving')
            AND q.queue_date = CURRENT_DATE
          ORDER BY 
            q.id ASC;
          `,
          [section_id]
        );
        
        const staffData = rows.reduce((acc, row) => {
          if (row.status === 'serving') {
            acc.serving.push(row);
          } else {
            acc.waiting.push(row);
          }
          return acc;
        }, { serving: [], waiting: [] });

        return json({
          success: true,
          role: "staff",
          data: staffData,
        }, 200, origin);
      }

      // ===============================
      // 👤 USER & GUEST VIEW
      // ===============================
      const userAuth = await verifyUser(req);
      const isUser = !userAuth.error;
      const identifier = isUser ? userAuth.user_id : guest_token;

      if (identifier) {
        const { rows } = await db.query(
          `SELECT q.*, s.wait_default,
            CASE WHEN q.status IN ('waiting', 'serving') THEN (
              SELECT COUNT(*) FROM queue q2 
              WHERE q2.section_id = q.section_id AND q2.queue_date = q.queue_date 
              AND q2.status = 'waiting' AND q2.id < q.id
            ) ELSE NULL END AS people_ahead
          FROM queue q
          JOIN section s ON q.section_id = s.id
          WHERE q.${isUser ? 'user_id' : 'token'} = $1
          ORDER BY q.created_at DESC`,
          [identifier]
        );

        const data = rows.reduce((acc, q) => {
          const isWaiting = ['waiting', 'serving'].includes(q.status);
          const ahead = parseInt(q.people_ahead) || 0;
          
          const item = isWaiting ? { 
            ...q, 
            people_ahead: ahead, 
            predicted_wait_minutes: ahead * (q.wait_default || 0) 
          } : q;

          acc[isWaiting ? 'active' : 'inactive'].push(item);
          return acc;
        }, { active: [], inactive: [] });

        return json({ 
          success: true, 
          role: isUser ? "user" : "guest", 
          data 
        }, 200, origin);
      }

      return json({ success: false, message: "unauthorized" }, 401, origin);
    } catch (err) {
      console.error(err);
      return json({ success: false, message: "internal server error" }, 500, origin);
    }
  }, req, origin);
}

export async function PUT(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();
  return withTimer(async () => {
    try {
      const { searchParams } = new URL(req.url);
      const id = Number(searchParams.get("id"));

      const { status, queue_detail, section_id, next, counter_id } = await req.json();
      const allowedStatus = ["no_show", "complete", "serving", "transfer"];

      if (!allowedStatus.includes(status)) {
        return json({ success: false, message: "invalid status" }, 400, origin);
      }
        
      const queueCheck = await client.query(
        `SELECT id, section_id, status
        FROM queue
        WHERE id = $1
        FOR UPDATE`,
        [id]
      );

      if (!queueCheck.rowCount) {
        await client.query("ROLLBACK");
        return json({ success: false, message: "queue not found" }, 404, origin);
      }
      const queuesection_id = queueCheck.rows[0].section_id;

      // 1. Verify staff
      const auth = await verifyStaff(req,queuesection_id);
      if (!auth.error) {
        await client.query("BEGIN");
        
        const staff_id = auth.staff_id;
        const staff_counter_id = auth.counter_id;

        // 2. Get request body

        let result;
        
        if (status === "no_show") {
          // 3.1 UPDATE queue no_show
          result = await client.query(
            `UPDATE queue
            SET status='no_show', end_at=NOW()
            WHERE id=$1 AND status='serving' AND staff_id=$2`,
            [id, staff_id]
          );
        } else if (status === "complete") {
          // 3.2 UPDATE queue complete
          result = await client.query(
            `UPDATE queue
            SET status='complete', detail=$1, end_at=NOW()
            WHERE id=$2 AND status='serving' AND staff_id=$3`,
            [queue_detail, id, staff_id]
          );
        } else if (status === "transfer") {

          const sectionCheck = await client.query(
            `SELECT id FROM section
            WHERE id=$1 AND is_deleted=false`,
            [section_id]
          );

          if (!sectionCheck.rowCount) {
            await client.query("ROLLBACK");
            return json({ success: false, message: "invalid target section" }, 400, origin);
          }

          // 3.4.1 UPDATE queue transfer
          const updateOld = await client.query(
            `UPDATE queue
            SET status='transfer', staff_id=$2, detail=$3, end_at = NOW()
            WHERE id=$1 AND status='serving' AND staff_id=$2
            RETURNING *`,
            [id, staff_id, queue_detail]
          );

          if (!updateOld.rowCount) {
            await client.query("ROLLBACK");
            return json({ success: false, message: "queue not found or invalid state" }, 400, origin);
          }

          const oldQueue = updateOld.rows[0];
          // 3.4.2 INSERT queue
          result = await client.query(
            `INSERT INTO queue (number, name, phone_num, detail, queue_date, user_id, section_id, status, token)
            VALUES ($1,$2,$3,$4,$5,$6,$7,'waiting',$8)
            RETURNING *`,
            [
              oldQueue.number,
              oldQueue.name,
              oldQueue.phone_num,
              oldQueue.detail,
              oldQueue.queue_date,
              oldQueue.user_id,
              section_id,
              oldQueue.token
            ]
          );
          console.log(section_id)
        }
        if (next||status === "serving") {
          // 3.3 UPDATE queue serving
          if(!staff_counter_id){
            await client.query(
              `UPDATE staff_role 
              SET counter_id = $1
              WHERE staff_id = $2
              AND section_id = $3`,
              [counter_id, staff_id, queuesection_id]
            );

          }else if(staff_counter_id!=counter_id){
            console.log(staff_counter_id)
            console.log(counter_id)
            await client.query("ROLLBACK");
            return json({ success: false, message: "invalid target counter" }, 400, origin);
          }
          const { rows } = await client.query(
            `SELECT id
            FROM queue
            WHERE section_id = $1
            AND status = 'waiting'
            AND queue_date = CURRENT_DATE
            ORDER BY id
            LIMIT 1`,
            [queuesection_id]
          );
          if(!rows[0]){
            await client.query(
              `UPDATE staff_role SET counter_id = NULL WHERE staff_id = $1 AND section_id = $2`,
              [staff_id, queuesection_id]
            );
        
            await client.query("COMMIT"); // Commit the counter release
            return json({ success: true, message: "No patients waiting", data: null }, 200, origin);//but it dont have logz
          }else{
            const queue_id = rows[0].id
          
            result = await client.query(
              `UPDATE queue SET status='serving', start_at=NOW(), staff_id=$2 WHERE id=$1 AND status='waiting' RETURNING *`,
              [queue_id, staff_id]
            );
          }
        }else{
          await client.query(
            `UPDATE staff_role SET counter_id = NULL WHERE staff_id = $1 AND section_id = $2`,
            [staff_id, queuesection_id]
          );
        }

        if (!result || !result.rowCount) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "queue not found or invalid state" }, 400, origin);
        }

        // 4. Insert log
        const detail = `update queue ${id} to ${status}`;

        await client.query(
          `INSERT INTO log (staff_id, action_type, action, target)
          VALUES ($1, $2, $3, $4)`,
          [staff_id, "update", detail, "queue"]
        );

        await client.query("COMMIT");
        return json({ success: true, role: "staff", data: result.rows[0]}, 200, origin);
      }

      // 1. Verify User
      const userAuth = await verifyUser(req);

      if (!userAuth.error) {
        await client.query("BEGIN");

        const { user_id } = userAuth;

        const result = await client.query(
          `UPDATE queue
          SET status='cancel', end_at=NOW()
          WHERE id=$1
            AND user_id=$2
            AND status='waiting'
          RETURNING *`,
          [id, user_id]
        );

        if (!result.rowCount) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "cannot cancel" }, 400, origin);
        }

        await client.query("COMMIT");

        return json({
          success: true,
          role: "user",
          data: result.rows[0]
        }, 200, origin);
      }

      const guest_token  = req.cookies.get("guest_token")?.value;

      if (guest_token) {
        await client.query("BEGIN");
        const result = await client.query(
          `UPDATE queue SET status='cancel', end_at=NOW()
          WHERE id=$1 AND token=$2 AND status='waiting'
          RETURNING *`,
          [id, guest_token]
        );


        if (result.rowCount) {
          await client.query("COMMIT");
          return json({ success: true, role: "guest", message: "cancel" }, 200, origin);
        }
      }

      await client.query("ROLLBACK");
      console.log("Unauthorized")
      return json({ success: false, message: "Unauthorized" }, 401, origin);
    } catch (err) {
      console.error("Update queue error:", err);

      try {
        await client.query("ROLLBACK");
      } catch {}

      return json({ success: false, message: "internal server error" }, 500, origin);
    } finally {
      client.release();
    }
  }, req, origin);
}

