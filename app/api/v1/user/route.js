import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req) {
  const client = await db.connect();

  try {
    const { phone_num } = await req.json();

    await client.query("BEGIN");

    const otpResult = await client.query(
      `SELECT id FROM phone_otps
       WHERE phone_num=$1
       AND phone_verify=true
       AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [phone_num]
    );

    if (!otpResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Phone not verified" },
        { status: 400 }
      );
    }

    let userResult = await client.query(
      `SELECT id FROM users WHERE phone_num=$1`,
      [phone_num]
    );

    let user_id;

    if (userResult.rowCount) {
      user_id = userResult.rows[0].id;
    } else {
      const insertUser = await client.query(
        `INSERT INTO users (phone_num)
         VALUES ($1)
         RETURNING id`,
        [phone_num]
      );
      user_id = insertUser.rows[0].id;
      await client.query(
      `INSERT INTO log (user_id, action_type, target)
       VALUES ($1, $2, $3)`,
      [user_id, "create", "user"]
    );
    }
    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    await client.query(
      `INSERT INTO user_token (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [hashedToken, user_id, expiresAt]
    );

    await client.query(
      `DELETE FROM phone_otps WHERE id=$1`,
      [otpResult.rows[0].id]
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
      `SELECT id, phone_num FROM users WHERE id=$1 AND is_deleted=false`,
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
    const { phone_num } = await req.json();

    const userAuth = await verifyUser(req);
    if (userAuth.error) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user_id } = userAuth;

    await client.query("BEGIN");

    // 1️⃣ Check verified phone
    const otpCheck = await client.query(
      `SELECT id
       FROM phone_otps
       WHERE phone_num=$1
       AND phone_verify=true
       AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [phone_num]
    );

    if (!otpCheck.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Phone not verified" },
        { status: 400 }
      );
    }

    // 2️⃣ Check duplicate phone
    const phoneExists = await client.query(
      `SELECT id FROM users WHERE phone_num=$1`,
      [phone_num]
    );

    if (phoneExists.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Phone already in use" },
        { status: 400 }
      );
    }

    // 3️⃣ Get old phone (for logging)
    const oldUser = await client.query(
      `SELECT phone_num FROM users WHERE id=$1`,
      [user_id]
    );

    const oldPhone = oldUser.rows[0].phone_num;

    // 4️⃣ Update phone
    const result = await client.query(
      `UPDATE users
       SET phone_num=$1
       WHERE id=$2
       RETURNING id, phone_num`,
      [phone_num, user_id]
    );

    // 5️⃣ Insert log
    await client.query(
      `INSERT INTO log (user_id, action_type, action, target)
       VALUES ($1, $2, $3, $4)`,
      [
        user_id,
        "update_phone",
        `Changed phone from ${oldPhone} to ${phone_num}`,
        "user"
      ]
    );

    // 6️⃣ Cleanup OTP
    await client.query(
      `DELETE FROM phone_otps WHERE id=$1`,
      [otpCheck.rows[0].id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );

  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}

    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function DELETE(req) {
  const client = await db.connect();
  
  try {
    // 1. Get verifyUser
    const auth = await verifyUser(req);
    if (auth.error) return auth.error;

    const { user_id } = auth;

    await client.query("BEGIN");
    // 3. Soft delete users
    const { rowCount } = await client.query(
      `UPDATE users 
       SET is_deleted=true 
       WHERE id=$1 AND is_deleted=false`,
      [user_id]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "not found" },
        { status: 404 }
      );
    }

    await client.query(
      `DELETE FROM user_token WHERE user_id = $1`,
      [user_id]
    );

    // 4. INSERT log
    const detail = "user_id = " + user_id
    await client.query(
      `INSERT INTO log (user_id, action_type, action, target)
      VALUES ($1, $2, $3, $4)`,
      [user_id, "delete", detail, "user"]
    );

    await client.query("COMMIT");

    return NextResponse.json({ message: "deleted" });
  } catch (err) {
    console.error(err);
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