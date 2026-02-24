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

    ///check  num is have in db
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const ticket = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id
       FROM otp_verification
       WHERE phone_num = $1`,
      [phone_num]
    );

    if (existing.rowCount > 0) {
      // 🔄 Rebuild existing OTP
      await client.query(
        `UPDATE otp_verification
         SET ticket = $1,
             otp_hash = $2,
             expires_at = $3,
             attempt = 0
         WHERE id = $4`,
        [ticket, hashedOtp, expiresAt, existing.rows[0].id]
      );
    } else {
      // ➕ Create new OTP row
      await client.query(
        `INSERT INTO otp_verification
         (phone_num, ticket, otp_hash, expires_at, attempt, phone_verify)
         VALUES ($1, $2, $3, $4, 0, false)`,
        [phone_num, ticket, hashedOtp, expiresAt]
      );
    }

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