import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(req) {
  const client = await db.connect();

  try {
    const { ticket, queue_token } = await req.json();

    if (!ticket) {
      return NextResponse.json(
        { message: "ticket required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    // Lock OTP row to prevent replay/race condition
    const otpResult = await client.query(
      `SELECT id, phone_num
       FROM phone_otps
       WHERE ticket = $1
       AND phone_verify = true
       AND expires_at > NOW()
       FOR UPDATE`,
      [ticket]
    );

    if (!otpResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Invalid or expired session" },
        { status: 400 }
      );
    }

    const { id: otp_id, phone_num } = otpResult.rows[0];

    // Find or create user
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

    // Generate secure session token
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days

    await client.query(
      `INSERT INTO user_token (token_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [hashedToken, user_id, expiresAt]
    );

    if (Array.isArray(queue_token) && queue_token.length > 0) {
      await client.query(
        `UPDATE queue
        SET user_id = $1, token = null
        WHERE token = ANY($2::text[])
        AND user_id IS NULL`,
        [user_id, queue_token]//do i need to update phone num
      );
    }
    // DELETE OTP → single use only
    await client.query(
      `DELETE FROM phone_otps WHERE id=$1`,
      [otp_id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        user_id,
        token // return raw token ONCE
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
      `SELECT id, phone_num FROM users WHERE id=$1`,
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
    const { ticket } = await req.json();

    if (!ticket) {
      return NextResponse.json(
        { message: "ticket required" },
        { status: 400 }
      );
    }

    const userAuth = await verifyUser(req);
    if (userAuth.error) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user_id } = userAuth;

    await client.query("BEGIN");

    // 1️⃣ Lock verified OTP session
    const otpCheck = await client.query(
      `SELECT id, phone_num
       FROM phone_otps
       WHERE ticket=$1
       AND phone_verify=true
       AND expires_at > NOW()
       FOR UPDATE`,
      [ticket]
    );

    if (!otpCheck.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Phone not verified" },
        { status: 400 }
      );
    }

    const { id: otp_id, phone_num } = otpCheck.rows[0];

    // 2️⃣ Check duplicate phone
    const phoneExists = await client.query(
      `SELECT id FROM users WHERE phone_num=$1 AND id <> $2`,
      [phone_num, user_id]
    );

    if (phoneExists.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Phone already in use" },
        { status: 400 }
      );
    }

    // 3️⃣ Get old phone (lock user row)
    const oldUser = await client.query(
      `SELECT phone_num FROM users WHERE id=$1 FOR UPDATE`,
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

    // 6️⃣ Delete OTP (single use)
    await client.query(
      `DELETE FROM phone_otps WHERE id=$1`,
      [otp_id]
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
  const auth = await verifyUser(req);
  if (auth.error) return auth.error;

  const { token_hash } = auth;

  await db.query(
    `DELETE FROM user_token WHERE token_hash=$1`,
    [token_hash]
  );

  return NextResponse.json({ message: "logged out" });
}