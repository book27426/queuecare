import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req) {
  const client = await db.connect();

  try {
    const body = await req.json();
    const { name, phone_num } = body;

    if (!name) {
      return NextResponse.json(
        { message: "name is required" },
        { status: 400 }
      );
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await client.query("BEGIN");

    // 1️. Insert user
    const { rows } = await client.query(
      `INSERT INTO users (name, phone_num)
       VALUES ($1, $2)
       RETURNING id`,
      [name, phone_num]
    );

    const user_id = rows[0].id;

    // 2️. Insert token
    await client.query(
      `INSERT INTO user_token (token, user_id)
       VALUES ($1, $2)`,
      [hashedToken, user_id]
    );

    // 3️. Insert log
    await client.query(
      `INSERT INTO log (user_id, action_type, target)
       VALUES ($1, $2, $3)`,
      [user_id, "create", "user"]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        user_id,
        token: token, // return raw token only once then user side store it
      },
      { status: 201 }
    );

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function GET(req) {
  try {
    // 1. Get id params
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id){
      // 2.1. verifyUser
      const auth = await verifyUser(req);
      if (auth.error) return auth.error;
      id = auth.user_id
    }else{
      // 2.2. verifyStaff
      const auth = await verifyStaff(req);
      if (auth.error) return auth.error;
    }

    // 3. Select users
    const { rows } = await db.query(
      `SELECT * FROM users WHERE id=$1 AND is_deleted=false`,
      [id]
    );

    if (!rows.length)
      return NextResponse.json({ message: "not found" }, { status: 404 });

    return NextResponse.json(rows[0]);

  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function PUT(req) {
  const client = await db.connect();

  try {
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    const { staff_id } = auth;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id required" },
        { status: 400 }
      );
    }

    const { name } = await req.json();

    await client.query("BEGIN");

    const { rowCount } = await client.query(
      `UPDATE users 
       SET name=$1 
       WHERE id=$2 AND is_deleted=false`,
      [name, id]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "not found" },
        { status: 404 }
      );
    }

    await client.query(
      `INSERT INTO log (staff_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [staff_id, "update", `Updated user ${id}`, "user"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ message: "updated" });

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(req) {
  try {
    // 1. Get verifyStaff
    const auth = await verifyStaff(req);
    if (auth.error) return auth.error;

    const { staff_id } = auth;

    // 2. Get id params
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { message: "id required" },
        { status: 400 }
      );
    }

    // 3. Soft delete users
    const { rowCount } = await db.query(
      `UPDATE users 
       SET is_deleted=true 
       WHERE id=$1 AND is_deleted=false`,
      [id]
    );

    if (!rowCount) {
      return NextResponse.json(
        { message: "not found" },
        { status: 404 }
      );
    }
    // 4. INSERT log
    const detail = "user_id = " + id
    await db.query(
      `INSERT INTO log (staff_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [staff_id, "delete", detail, "user"]
    );

    return NextResponse.json({ message: "deleted" });
  } catch {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }
}