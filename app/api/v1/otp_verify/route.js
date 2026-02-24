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
    const ticket = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await client.query("BEGIN");

    // Invalidate previous unverified OTPs
    await client.query(
      `UPDATE otp_verification
       SET expires_at = NOW()
       WHERE phone_num = $1
       AND phone_verify = false`,
      [phone_num]
    );

    await client.query(
      `INSERT INTO otp_verification
       (phone_num, ticket, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [phone_num, ticket, hashedOtp, expiresAt]
    );

    await client.query("COMMIT");

    console.log("OTP:", otp);

    return NextResponse.json(
      { success: true, ticket },
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
    const { ticket, otp } = await req.json();

    if (!ticket || !otp) {
      return NextResponse.json(
        { message: "ticket and otp required" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const result = await client.query(
      `SELECT *
       FROM otp_verification
       WHERE ticket=$1
       AND phone_verify=false
       AND expires_at > NOW()
       FOR UPDATE`,
      [ticket]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    const otpRow = result.rows[0];

    // Check attempt limit
    if (otpRow.attempt >= 5) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { message: "Too many attempts" },
        { status: 403 }
      );
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (hashedOtp !== otpRow.otp_hash) {
      await client.query(
        `UPDATE otp_verification
         SET attempt = attempt + 1
         WHERE id=$1`,
        [otpRow.id]
      );

      await client.query("COMMIT");

      return NextResponse.json(
        { message: "Invalid OTP" },
        { status: 400 }
      );
    }

    // Mark verified
    await client.query(
      `UPDATE otp_verification
       SET phone_verify=true
       WHERE id=$1`,
      [otpRow.id]
    );

    await client.query("COMMIT");

    return NextResponse.json(
      { success: true, ticket: ticket, phone_num: otpRow.phone_num },
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