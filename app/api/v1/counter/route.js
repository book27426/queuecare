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
      // 1️. get section_id from URL
      const { searchParams } = new URL(req.url);
      const section_id = Number(searchParams.get("id"));

      if (!section_id || Number.isNaN(section_id))
        return json({ success: false, message: "valid section id required" }, 400, origin);

      // 2️. get body
      const { name } = await req.json();

      if (!name)
        return json({ success: false, message: "counter name required" }, 400, origin);

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

      return json({ success: true, data: rows[0] }, 201, origin);
      
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
      const { name } = await req.json();

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

      return json({ success: true, data: rows[0] }, 200, origin);

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
  const client = await db.connect();

  try {
    const { searchParams } = new URL(req.url);
    const counterId = Number(searchParams.get("id"));

    if (!counterId || Number.isNaN(counterId)) {
      return NextResponse.json(
        { success: false, message: "counter_id is required" },
        { status: 400 }
      );
    }

    // 1️⃣ Get counter info
    const counterCheck = await client.query(
      `
      SELECT id, name, section_id
      FROM counter
      WHERE id = $1
      `,
      [counterId]
    );

    if (!counterCheck.rowCount) {
      return NextResponse.json(
        { success: false, message: "counter not found" },
        { status: 404 }
      );
    }

    const counter = counterCheck.rows[0];

    // 2️⃣ Verify staff permission
    const auth = await verifyStaff(req, counter.section_id);

    if (auth.error) return auth.error;

    // 3️⃣ Get current serving queue
    const currentQueue = await client.query(
      `
      SELECT
        q.id,
        q.number,
        q.name,
        q.phone_num,
        q.start_at
      FROM queue q
      JOIN staff_role sr
        ON sr.staff_id = q.staff_id
      WHERE sr.counter_id = $1
      AND q.status = 'serving'
      AND q.queue_date = CURRENT_DATE
      LIMIT 1
      `,
      [counterId]
    );

    // 4️⃣ Get waiting queues in this section
    const waitingQueues = await client.query(
      `
      SELECT number, name
      FROM queue
      WHERE section_id = $1
      AND queue_date = CURRENT_DATE
      AND status = 'waiting'
      ORDER BY number
      `,
      [counter.section_id]
    );

    return NextResponse.json({
      success: true,
      data: {
        counter,
        current_queue: currentQueue.rows[0] || null,
        waiting_queues: waitingQueues.rows
      }
    });

  } catch (err) {

    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );

  } finally {
    client.release();
  }
}