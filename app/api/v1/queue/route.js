import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUser } from "@/lib/auth";

export async function POST(req) {
  const client = await db.connect();

  try {
    // 🔐 1. Verify staff
    const auth = await verifyUser(req);
    if (auth.error) return auth.error;
    
    const user_id = auth.user_id;

    // 📦 2. Get request body
    let { section_id } = await req.json();
    section_id = Number(section_id);

    if (!Number.isInteger(section_id) || section_id <= 0) {
      return NextResponse.json(
        { message: "section_id is invaild" },
        { status: 400 }
      );
    }
    
    await client.query("BEGIN");

    const sectionCheck = await client.query(
      `SELECT id FROM section
      WHERE id=$1 AND is_deleted=false
      FOR UPDATE`,
      [section_id]
    );

    // 3. generate number
    if (!sectionCheck.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "section not found" },
        { status: 404 }
      );
    }

    let number = "001";

    const lastQueue = await client.query(
      `SELECT number FROM queue
       WHERE section_id=$1
       ORDER BY id DESC
       LIMIT 1`,
      [section_id]
    );

    if (lastQueue.rows.length > 0) {
      const lastNumber = parseInt(lastQueue.rows[0].number, 10);
      number = String(lastNumber + 1).padStart(3, "0");
    }

    
    // 💾 4. Insert section
    const queue = await client.query(
      `INSERT INTO queue (number, user_id, section_id)
        VALUES ($1,$2,$3)
        RETURNING *`,
      [number, user_id, section_id]
    );

    //  5. Insert log
    await client.query(
      `INSERT INTO log (user_id, action_type,target)
        VALUES ($1, $2, $3)`,
      [user_id, "create", "queue"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ success: true,data: queue.rows[0]}, { status: 201 });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    console.error(err);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
};

export async function GET(req) {
  try {
    // 🔐 Try staff first
    const staffAuth = await verifyStaff(req);

    // ===============================
    // 🧑‍💼 STAFF VIEW
    // ===============================
    if (!staffAuth.error) {
      const { section_id } = staffAuth;

      const { rows } = await db.query(
        `SELECT *
         FROM queue
         WHERE section_id = $1
           AND status = 'waiting'
         ORDER BY id ASC`,
        [section_id]
      );

      return NextResponse.json({
        role: "staff",
        data: rows,///มันจะหนักไปไหม
      });
    }

    // ===============================
    // 👤 USER VIEW
    // ===============================
    const userAuth = await verifyUser(req);
    if (userAuth.error) return userAuth.error;

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
      role: "user",
      active,
      inactive,
    });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  const client = await db.connect();

  try {
    // 1. Verify staff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    const staff_id = auth.staff_id;

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { message: "valid id is required" },
        { status: 400 }
      );
    }

    // 2. Get request body
    const { status, queue_detail, section_id } = await req.json();

    await client.query("BEGIN");

    let result;

    
    if (status === "cancel" || status === "no_show") {
      // 3.1 UPDATE queue cancel and no_show
      result = await client.query(
        `UPDATE queue
         SET status=$1, end_at=NOW()
         WHERE id=$2 AND status IN ('waiting','serving')`,
        [status, id]
      );
    } else if (status === "complete") {
      // 3.2 UPDATE queue complete
      result = await client.query(
        `UPDATE queue
         SET status=$1, detail=$2, end_at=NOW()
         WHERE id=$3 AND status='serving'`,
        [status, queue_detail, id]
      );
    } else if (status === "serving") {
      // 3.3 UPDATE queue serving
      result = await client.query(
        `UPDATE queue
         SET status='serving', start_at=NOW(), staff_id=$2
         WHERE id=$1 AND status='waiting'`,
        [id, staff_id]
      );
    } else if (status === "transfer") {

      if (!section_id) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "section_id required for transfer" },
          { status: 400 }
        );
      }
      // 3.4.1 UPDATE queue transfer
      const updateOld = await client.query(
        `UPDATE queue
         SET status='transferred', staff_id=$2
         WHERE id=$1 AND status IN ('waiting','serving')
         RETURNING *`,
        [id, staff_id]
      );

      if (!updateOld.rowCount) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { message: "queue not found or invalid state" },
          { status: 400 }
        );
      }

      const oldQueue = updateOld.rows[0];
      // 3.4.2 INSERT queue
      result = await client.query(
        `INSERT INTO queue (number, detail, queue_date, user_id, section_id, status)
         VALUES ($1,$2,$3,$4,$5,'waiting')
         RETURNING *`,
        [
          oldQueue.number,
          oldQueue.detail,
          oldQueue.queue_date,
          oldQueue.user_id,
          section_id
        ]
      );
    } else {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "invalid status" },
        { status: 400 }
      );
    }

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "queue not found or invalid state" },
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

    return NextResponse.json({ message: "updated successfully" });

  } catch (err) {
    console.error("Update queue error:", err);

    try {
      await client.query("ROLLBACK");
    } catch {}

    return NextResponse.json(
      { message: "internal server error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}