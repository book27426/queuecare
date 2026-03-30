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
  
  // 1. All Non-DB work first
  const auth = await verifyUser(req);
  const user_id = auth?.error ? null : auth.user_id;
  let { section_id, name, phone_num } = await req.json();
  section_id = Number(section_id);

  if (!Number.isInteger(section_id) || section_id <= 0 || !name || !phone_num) {
    return json({ success: false, message: "invalid body" }, 400, origin);
  }

  let guest_token = null;
  let needSetCookie = false;
  if (user_id === null) {
    guest_token = req.cookies.get("guest_token")?.value;
    if (!guest_token) {
      guest_token = crypto.randomUUID();
      needSetCookie = true;
    }
  }

  // 2. Open connection
  const client = await db.connect();

  return withTimer(async () => {
    try {
      await client.query("BEGIN");

      // Use FOR SHARE - it's non-blocking for reads
      const sectionRes = await client.query(
        `SELECT wait_default FROM section 
        WHERE id = $1 AND is_deleted = false`, // Use FOR UPDATE here
        [section_id]
      );

      if (!sectionRes.rowCount) throw new Error("404");
      const { wait_default } = sectionRes.rows[0];

      // 3. The "Atomic" Insert
      // To truly prevent deadlocks, use a DB Sequence or lock the table rows properly
      const queueInsert = await client.query(
        `INSERT INTO queue (number, name, phone_num, user_id, section_id, token)
        VALUES (
          (SELECT COALESCE(MAX(number), 0) + 1 FROM queue WHERE section_id = $1 AND queue_date = CURRENT_DATE),
          $2, $3, $4, $5, $6
        ) RETURNING id, number`,
        [section_id, name, phone_num, user_id, section_id, guest_token]
      );

      const newId = queueInsert.rows[0].id;

      // 4. Count people ahead
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
        //data: { ...queueInsert.rows[0], people_ahead, predicted_wait_minutes: people_ahead * wait_default }
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

      console.log(err);
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
        if (!section_id) {
          return json({ success: false, error: "Invalid Section ID" }, 400, origin);
        }
        const { rows } = await db.query(
          `(SELECT q.id, q.number, c.name AS counter_name, q.status, q.start_at
            FROM queue q
            LEFT JOIN staff_role sr ON q.staff_id = sr.staff_id
            LEFT JOIN counter c ON sr.counter_id = c.id
            WHERE q.section_id = $1 
              AND q.start_at IS NOT NULL
              AND q.queue_date = CURRENT_DATE
            LIMIT 5)
          UNION ALL
          (SELECT q.id, q.number, c.name AS counter_name, q.status, q.start_at
            FROM queue q
            LEFT JOIN staff_role sr ON q.staff_id = sr.staff_id
            LEFT JOIN counter c ON sr.counter_id = c.id
            WHERE q.section_id = $1 
              AND q.status = 'no_show' 
              AND q.queue_date = CURRENT_DATE
            ORDER BY q.start_at DESC
            LIMIT 10)`,
          [section_id]
        );

        const staffData = rows.reduce((acc, row) => {
          if (row.status === 'serving') {
            acc.currently_serving.push(row);
          } else {
            acc.recent_logs.push(row);
          }
          return acc;
        }, { currently_serving: [], recent_logs: [] });

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
      const allowedStatus = ["no_show", "complete", "serving", "transfer", "cancel"];
      if (!allowedStatus.includes(status)&& status) {
        return json({ success: false, message: "invalid status" }, 400, origin);
      }

      let queuesection_id
      if(id){
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
        queuesection_id = queueCheck.rows[0].section_id;
      }else{
        const countercheck = await client.query(
          `SELECT id, section_id, is_active
          FROM counter
          WHERE id = $1
          FOR UPDATE`,
          [counter_id]
        );

        if (!countercheck.rowCount) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "counter not found" }, 404, origin);
        }
        queuesection_id = countercheck.rows[0].section_id;
      }
      

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
            RETURNING number, name, phone_num, detail, queue_date, user_id, token`,
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
            VALUES ($1,$2,$3,$4,$5,$6,$7,'waiting',$8)`,
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
            await client.query("ROLLBACK");
            return json({ success: false, message: "invalid target counter" }, 400, origin);
          }

          if(!id){
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
                `UPDATE queue SET status='serving', start_at=NOW(), staff_id=$2 WHERE id=$1 AND status='waiting'`,
                [queue_id, staff_id]
              );
            }
          }else if(status === "serving"){
            result = await client.query(
              `UPDATE queue SET status='serving', start_at=NOW(), staff_id=$2 WHERE id=$1 AND status IN ('serving', 'no_show')`,
              [id, staff_id]
            );
          }
        }else{
          await client.query(
            `UPDATE staff_role SET counter_id = NULL WHERE staff_id = $1 AND section_id = $2`,
            [staff_id, queuesection_id]
          );
        }

        if (!result) {
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
        return json({ success: true, role: "staff"}, 200, origin);
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
            AND status='waiting'`,
          [id, user_id]
        );

        if (!result.rowCount) {
          await client.query("ROLLBACK");
          return json({ success: false, message: "cannot cancel" }, 400, origin);
        }

        await client.query("COMMIT");

        return json({
          success: true,
          role: "user"
        }, 200, origin);
      }

      const guest_token  = req.cookies.get("guest_token")?.value;

      if (guest_token) {
        await client.query("BEGIN");
        const result = await client.query(
          `UPDATE queue SET status='cancel', end_at=NOW()
          WHERE id=$1 AND token=$2 AND status='waiting'`,
          [id, guest_token]
        );


        if (result.rowCount) {
          await client.query("COMMIT");
          return json({ success: true, role: "guest", message: "cancel" }, 200, origin);
        }
      }

      await client.query("ROLLBACK");
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

// UPDATE Queue
// SET status = 'cancel',
//     end_at  = NOW()
// WHERE queue_date < CURRENT_DATE
//   AND status NOT IN ('complete', 'cancel');