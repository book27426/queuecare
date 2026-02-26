import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff, verifyUser } from "@/lib/auth";
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
    ) {
      return NextResponse.json(
        { success: false, message: "invalid body" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const sectionCheck = await client.query(
      `SELECT id FROM section
       WHERE id = $1 AND is_deleted = false
       FOR UPDATE`,
      [section_id]
    );

    if (!sectionCheck.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "section not found" },
        { status: 404 }
      );
    }

    // 3. generate number
    let number = "001";

    const lastQueue = await client.query(
      `SELECT number
       FROM queue
       WHERE section_id = $1
         AND queue_date = CURRENT_DATE
       ORDER BY id DESC
       LIMIT 1`,
      [section_id]
    );

    if (lastQueue.rows.length > 0) {
      const lastNumber = parseInt(lastQueue.rows[0].number, 10);
      number = String(lastNumber + 1).padStart(3, "0");
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
      `INSERT INTO queue 
        (number, name, phone_num, user_id, section_id, token)
        VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [number, name, phone_num, user_id, section_id, guest_token]
    );

    // 6. Insert log
    if (user_id) {
      await client.query(
        `INSERT INTO log (user_id, action_type, target)
         VALUES ($1, $2, $3)`,
        [user_id, "create", "queue"]
      );
    }

    await client.query("COMMIT");

    const response = NextResponse.json(
      { success: true, data: queueInsert.rows[0] },
      { status: 201 }
    );

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
    return NextResponse.json(
      { success: false, message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
};

export async function GET(req) {
  const origin = req.headers.get("origin");
  try {
    const guest_token  = req.cookies.get("guest_token")?.value;

    const staffAuth = await verifyStaff(req);
    // 🧑‍💼 STAFF VIEW
    if (!staffAuth.error) {
      const { section_id } = staffAuth;

      const { rows } = await db.query(
        `SELECT *
         FROM queue
         WHERE section_id = $1
           AND status IN ('waiting', 'serving')
         ORDER BY id ASC`,
        [section_id]
      );

      return NextResponse.json({
        success: true,
        role: "staff",
        data: rows,
      });
    }

    // ===============================
    // 👤 USER VIEW
    // ===============================
    const userAuth = await verifyUser(req);

    if (!userAuth.error) {
      const { user_id } = userAuth;

      const { rows } = await db.query(
        `SELECT *
         FROM queue
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [user_id]
      );

      const active = [];
      const inactive = [];

      for (const q of rows) {
        if (q.status === "waiting" || q.status === "serving") {
          active.push(q);
        } else {
          inactive.push(q);
        }
      }

      return NextResponse.json({
        success: true,
        role: "user",
        data:{
          active,
          inactive
        }
      });
    }

    // ===============================
    // 👤 GUEST VIEW (NOT VERIFIED)
    // ===============================
    if (guest_token) {
      const { rows } = await db.query(
        `SELECT *
         FROM queue
         WHERE token = $1
         ORDER BY created_at DESC`,
        [guest_token]
      );

      const active = [];
      const inactive = [];

      for (const q of rows) {
        if (q.status === "waiting" || q.status === "serving") {
          active.push(q);
        } else {
          inactive.push(q);
        }
      }

      return NextResponse.json({
        success: true,
        role: "guest",
        data:{
          active,
          inactive
        }
      });
    }

    return NextResponse.json(
      { success: false, message: "unauthorized" },
      { status: 401 }
    );

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { success: false, message: "internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  const origin = req.headers.get("origin");
  const client = await db.connect();

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "valid id is required" },
        { status: 400 }
      );
    }

    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (!auth.error) {
      await client.query("BEGIN");
      
      const staff_id = auth.staff_id;
      const staff_section_id = auth.section_id
      // 2. Get request body
      const { status, queue_detail, section_id } = await req.json();

      const allowedStatus = ["no_show", "complete", "serving", "transfer"];

      if (!allowedStatus.includes(status)) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "invalid status" },
          { status: 400 }
        );
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
        return NextResponse.json(
          { success: false, message: "queue not found" },
          { status: 404 }
        );
      }

      const queue = queueCheck.rows[0];

      // Section permission check
      if (queue.section_id !== staff_section_id) {
        console.log(queue.section_id)
        console.log(staff_section_id)
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "not allowed" },
          { status: 403 }
        );
      }

      let result;
      
      if (status === "no_show") {
        // 3.1 UPDATE queue no_show
        result = await client.query(
          `UPDATE queue
          SET status='no_show', end_at=NOW()
          WHERE id=$1 AND status='serving' AND staff_id=$2
          RETURNING *`,
          [id, staff_id]
        );
      } else if (status === "complete") {
        // 3.2 UPDATE queue complete
        result = await client.query(
          `UPDATE queue
          SET status='complete', detail=$1, end_at=NOW()
          WHERE id=$2 AND status='serving' AND staff_id=$3
          RETURNING *`,
          [queue_detail, id, staff_id]
        );
      } else if (status === "serving") {
        // 3.3 UPDATE queue serving
        result = await client.query(
          `UPDATE queue
          SET status='serving', start_at=NOW(), staff_id=$2
          WHERE id=$1 AND status='waiting'
          RETURNING *`,
          [id, staff_id]
        );
      } else if (status === "transfer") {

        const sectionCheck = await client.query(
          `SELECT id FROM section
          WHERE id=$1 AND is_deleted=false`,
          [section_id]
        );

        if (!sectionCheck.rowCount) {
          await client.query("ROLLBACK");
          return NextResponse.json(
            { success: false, message: "invalid target section" },
            { status: 400 }
          );
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
          return NextResponse.json(
            { success: false, message: "queue not found or invalid state" },
            { status: 400 }
          );
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
      } else {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "invalid status" },
          { status: 400 }
        );
      }

      if (!result.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "queue not found or invalid state" },
          { status: 400 }
        );
      }

      // 4. Insert log
      const detail = `update queue ${id} to ${status}`;

      await client.query(
        `INSERT INTO log (staff_id, action_type, action, target)
        VALUES ($1, $2, $3, $4)`,
        [staff_id, "update", detail, "queue"]
      );

      await client.query("COMMIT");
      return NextResponse.json({ success: true, role: "staff", data: result.rows[0]}, { status: 200 });
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
        return NextResponse.json(
          { success: false, message: "cannot cancel" },
          { status: 400 }
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        role: "user",
        data: result.rows[0]
      });
    }

    const guest_token  = req.cookies.get("guest_token")?.value;

    if (guest_token) {
      const result = await client.query(
        `UPDATE queue SET status='cancel', end_at=NOW()
         WHERE id=$1 AND token=$2 AND status='waiting'
         RETURNING *`,
        [id, guest_token]
      );


      if (result.rowCount) {
        await client.query("COMMIT");
        return NextResponse.json({ success: true, role: "guest", message: "cancel" });
      }
    }

    await client.query("ROLLBACK");
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  } catch (err) {
    console.error("Update queue error:", err);

    try {
      await client.query("ROLLBACK");
    } catch {}

    return NextResponse.json(
      { success: false, message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}