import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req) {
  const client = await db.connect();

  try {
    const { phone_num } = await req.json();

    if (!phone_num) {
      return NextResponse.json(
        { message: "phone number required" },
        { status: 400 }
      );
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await client.query("BEGIN");

    await client.query(
      `INSERT INTO otp_verification (phone_num, otp_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [phone_num, hashedOtp, expiresAt]
    );

    await client.query("COMMIT");

    // TODO: send OTP via SMS provider here
    console.log("OTP:", otp);

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );

  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function PUT(req) {
  const client = await db.connect();

  try {
    const { phone_num, otp } = await req.json();

    await client.query("BEGIN");

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const result = await client.query(
      `SELECT * FROM otp_verification
       WHERE phone_num=$1
       AND otp_hash=$2
       AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1`,
      [phone_num, hashedOtp]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    await client.query(
    `UPDATE otp_verification
    SET phone_verify=true
    WHERE id=$1`,
    [otp_id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, phone_num: phone_num },
      { status: 200 }
    );

  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}