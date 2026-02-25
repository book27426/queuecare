import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyStaff, verifyUser } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req) {
  const client = await db.connect();

  try {
    const { otp } = await req.json();

    const guest_token  = req.cookies.get("guest_token")?.value;

    const ticket = req.cookies.get("otp_ticket")?.value;

    if (!ticket || !otp) {
      return NextResponse.json(
        { success: false, message: "Invalid session" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const { rows, rowCount } = await client.query(
      `SELECT *
       FROM phone_otp
       WHERE ticket=$1
       AND expires_at > NOW()
       FOR UPDATE`,
      [ticket]
    );

    if (!rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    const otpRow = rows[0];

    // Check attempt limit
    if (otpRow.attempt >= 5) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Too many attempts" },
        { status: 403 }
      );
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedOtp !== otpRow.otp) {
      await client.query(
        `UPDATE phone_otp
         SET attempt = attempt + 1
         WHERE id=$1`,
        [otpRow.id]
      );

      await client.query("COMMIT");

      console.log(hashedOtp)
      console.log(otpRow.otp)
      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }

    const phone_num = otpRow.phone_num;

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
      `INSERT INTO user_token (token, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [hashedToken, user_id, expiresAt]
    );

    if (guest_token) {
      await client.query(
        `UPDATE queue
        SET user_id = $1, token = null
        WHERE token = $2
        AND user_id IS NULL`,
        [user_id, guest_token]
      );
    }

    await client.query(
      `DELETE FROM phone_otp WHERE id=$1`,
      [otpRow.id]
    );

    await client.query("COMMIT");

    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    response.cookies.set("user_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    response.cookies.set("otp_ticket", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });

    response.cookies.set("guest_token", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    
    return response;

  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function GET(req) {
  // try {
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
      `SELECT id, phone_num FROM user WHERE id=$1`,
      [id]
    );

    if (!rows.length)
      return NextResponse.json({ success: false, message: "not found" }, { status: 404 });

    return NextResponse.json({success: true, "data":rows[0]});

  // } catch {
  //   return NextResponse.json(
  //     { success: false, message: "Unauthorized" },
  //     { status: 401 }
  //   );
  // }
}

export async function PUT(req) {
  const client = await db.connect();

  try {
    const { ticket, otp } = await req.json();

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "ticket required" },
        { status: 400 }
      );
    }

    const userAuth = await verifyUser(req);
    if (userAuth.error) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { user_id } = userAuth;

    await client.query("BEGIN");

    const otpResult = await client.query(
      `SELECT *
       FROM phone_otp
       WHERE ticket=$1
       AND expires_at > NOW()
       FOR UPDATE`,
      [ticket]
    );

    if (!otpResult.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    const otpRow = otpResult.rows[0];

    // Check attempt limit
    if (otpRow.attempt >= 5) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Too many attempts" },
        { status: 403 }
      );
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedOtp !== otpRow.otp) {
      await client.query(
        `UPDATE phone_otp
         SET attempt = attempt + 1
         WHERE id=$1`,
        [otpRow.id]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        { success: false, message: "Invalid OTP" },
        { status: 400 }
      );
    }

    const phone_num = otpRow.phone_num;

    // 2️⃣ Check duplicate phone
    const phoneExists = await client.query(
      `SELECT id FROM users WHERE phone_num=$1 AND id <> $2`,
      [phone_num, user_id]
    );

    if (phoneExists.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Phone already in use" },
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
      `DELETE FROM phone_otp WHERE id=$1`,
      [otpRow.id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, data: result.rows[0] },
      { status: 200 }
    );

  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}

    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
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
    `DELETE FROM user_token WHERE token=$1`,
    [token_hash]
  );

  return NextResponse.json({ success: false, message: "logged out" });
}